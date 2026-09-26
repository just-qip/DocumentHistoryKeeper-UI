import { Injectable, signal } from '@angular/core';

const KEY = 'dhk.sessionToken';

/** Хранит сессионный токен. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly _token = signal<string | null>(this.read());

  readonly token = this._token.asReadonly();

  set(token: string | null): void {
    if (token) {
      localStorage.setItem(KEY, token);
      this._token.set(token);
    } else {
      localStorage.removeItem(KEY);
      this._token.set(null);
    }
  }

  clear(): void {
    this.set(null);
  }

  private read(): string | null {
    return localStorage.getItem(KEY);
  }
}
