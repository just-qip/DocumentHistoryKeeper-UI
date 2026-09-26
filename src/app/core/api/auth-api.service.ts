import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Account } from '../models';

export interface AccountChoice {
  accountId: string;
  displayName: string;
}

export interface RegisterRequest {
  email: string;
  displayName: string;
  saltHex: string;
  verifierHex: string;
}

export interface ChallengeResponse {
  challengeId: string;
  saltHex: string;
  BHex: string;
}

export interface VerifyResponse {
  token: string;
  M2Hex: string;
  account: Account;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/auth`;

  /** @returns аккаунт по email или {@code null} */
  lookup(email: string): Observable<AccountChoice | null> {
    return this.http.post<AccountChoice | null>(`${this.base}/lookup`, { email });
  }

  register(req: RegisterRequest): Observable<Account> {
    return this.http.post<Account>(`${this.base}/register`, req);
  }

  challenge(email: string): Observable<ChallengeResponse> {
    return this.http.post<ChallengeResponse>(`${this.base}/challenge`, { email });
  }

  verify(challengeId: string, AHex: string, M1Hex: string): Observable<VerifyResponse> {
    return this.http.post<VerifyResponse>(`${this.base}/verify`, {
      challengeId,
      AHex,
      M1Hex,
    });
  }

  me(): Observable<Account> {
    return this.http.get<Account>(`${this.base}/me`);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/logout`, {});
  }
}
