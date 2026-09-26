import { Injectable } from '@angular/core';

/**
 * Параметры группы — те же, что на сервере (RFC 5054, 1024-bit, g=2, SHA-256).
 */
const N_HEX =
  'EEAF0AB9ADB38DD69C33F80AFA8FC5E86072618775FF3C0B9EA2314C9C256576' +
  'D674DF7496EA81D3383B4813D692C6E0E0D5D8E250B98BE48E495C1D6089DAD1' +
  '5DC7D7B46154D6B6CE8EF4AD69B15D4982559B297BCF1885C529F566660E57EC' +
  '68EDBC3C05726CC02FD4CBF4976EAA9AFD5138FE8376435B9FC61D2FC0EB06E3';

const N = BigInt('0x' + N_HEX);
const G = 2n;
const N_LEN = 128;

@Injectable({ providedIn: 'root' })
export class SrpService {
  private readonly enc = new TextEncoder();

  /** @returns 16 случайных байт */
  randomSalt(): Uint8Array {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return b;
  }

  /** @returns случайный 256-битный скаляр */
  randomScalar(): bigint {
    const b = new Uint8Array(32);
    crypto.getRandomValues(b);
    return this.bytesToBigInt(b);
  }

  /** @returns SHA-256 от конкатенации */
  async sha256(...parts: Uint8Array[]): Promise<Uint8Array> {
    let len = 0;
    for (const p of parts) len += p.length;
    const buf = new Uint8Array(len);
    let off = 0;
    for (const p of parts) {
      buf.set(p, off);
      off += p.length;
    }
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return new Uint8Array(hash);
  }

  /**
   * @param x целое
   * @returns 128 байт big-endian
   */
  bigIntToBytes(x: bigint): Uint8Array {
    let hex = x.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    if (bytes.length > N_LEN) throw new Error('integer too big');
    const out = new Uint8Array(N_LEN);
    out.set(bytes, N_LEN - bytes.length);
    return out;
  }

  /** @returns bigint из big-endian байтов */
  bytesToBigInt(b: Uint8Array): bigint {
    let hex = '0x';
    for (const x of b) hex += x.toString(16).padStart(2, '0');
    return BigInt(hex);
  }

  /** @returns base^exp mod mod (square-and-multiply) */
  modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = 1n;
    base = base % mod;
    while (exp > 0n) {
      if (exp & 1n) result = (result * base) % mod;
      exp >>= 1n;
      base = (base * base) % mod;
    }
    return result;
  }

  /** @returns k = H(N | PAD(g)) */
  private async k(): Promise<bigint> {
    return this.bytesToBigInt(await this.sha256(this.bigIntToBytes(N), this.bigIntToBytes(G)));
  }

  /**
   * Регистрация: считает salt и verifier. Пароль не покидает браузер.
   *
   * @param email email
   * @param password пароль
   * @returns соль и verifier (hex)
   */
  async register(
    email: string,
    password: string,
  ): Promise<{ saltHex: string; verifierHex: string }> {
    const salt = this.randomSalt();
    const x = await this.computeX(email, password, salt);
    const v = this.modPow(G, x, N);
    return {
      saltHex: this.toHex(salt),
      verifierHex: this.toHex(this.bigIntToBytes(v)),
    };
  }

  /**
   * Логин, шаг 1: считает A и доказательство M1 по ответу сервера.
   *
   * @param email email
   * @param password пароль
   * @param saltHex соль от сервера
   * @param BHex публичный эфемер сервера
   * @returns A, M1, K, B (внутренние)
   */
  async challenge(
    email: string,
    password: string,
    saltHex: string,
    BHex: string,
  ): Promise<{ A: bigint; AHex: string; M1Hex: string; K: Uint8Array; B: bigint }> {
    const salt = this.fromHex(saltHex);
    const B = this.bytesToBigInt(this.fromHex(BHex));

    const a = this.randomScalar();
    const A = this.modPow(G, a, N);
    if (A % N === 0n) throw new Error('bad A');

    const u = await this.computeU(A, B);
    const x = await this.computeX(email, password, salt);
    const k = await this.k();

    // S = (B - k*g^x)^(a + u*x) mod N
    const base = (B - this.modPow(G, x, N) * k) % N;
    const exp = a + u * x;
    const S = this.modPow((base + N) % N, exp, N);
    const K = await this.sha256(this.bigIntToBytes(S));

    const M1 = await this.sha256(
      this.xor(await this.sha256(this.bigIntToBytes(N)), await this.sha256(this.bigIntToBytes(G))),
      await this.sha256(this.enc.encode(email)),
      salt,
      this.bigIntToBytes(A),
      this.bigIntToBytes(B),
      K,
    );

    return { A, AHex: this.toHex(this.bigIntToBytes(A)), M1Hex: this.toHex(M1), K, B };
  }

  /**
   * Проверяет доказательство сервера M2.
   *
   * @param AHex A (hex)
   * @param M1Hex M1 (hex)
   * @param K сессионный ключ
   * @param M2Hex от сервера
   * @returns true, если M2 совпадает
   */
  async verifyServer(AHex: string, M1Hex: string, K: Uint8Array, M2Hex: string): Promise<boolean> {
    const expected = await this.sha256(this.fromHex(AHex), this.fromHex(M1Hex), K);
    return this.toHex(expected) === M2Hex.toLowerCase();
  }

  /** @returns x = H(salt | H(I : P)) */
  private async computeX(email: string, password: string, salt: Uint8Array): Promise<bigint> {
    const inner = await this.sha256(this.enc.encode(email + ':' + password));
    return this.bytesToBigInt(await this.sha256(salt, inner));
  }

  /** @returns u = H(PAD(A) | PAD(B)) */
  private async computeU(A: bigint, B: bigint): Promise<bigint> {
    return this.bytesToBigInt(await this.sha256(this.bigIntToBytes(A), this.bigIntToBytes(B)));
  }

  /** @returns побайтовый XOR */
  private xor(a: Uint8Array, b: Uint8Array): Uint8Array {
    const out = new Uint8Array(Math.min(a.length, b.length));
    for (let i = 0; i < out.length; i++) out[i] = a[i] ^ b[i];
    return out;
  }

  /** @returns hex-строка */
  private toHex(b: Uint8Array): string {
    return Array.from(b)
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('');
  }

  /** @returns байты из hex */
  private fromHex(s: string): Uint8Array {
    if (s.length % 2) s = '0' + s;
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  }
}
