import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Account } from '../models';

export interface ChangePasswordRequest {
  challengeId: string;
  aHex: string;
  m1Hex: string;
  newSaltHex: string;
  newVerifierHex: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/profile`;

  me(): Observable<Account> {
    return this.http.get<Account>(this.base);
  }

  update(displayName: string): Observable<Account> {
    return this.http.patch<Account>(this.base, { displayName });
  }

  uploadAvatar(file: File): Observable<Account> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<Account>(`${this.base}/avatar`, form);
  }

  deleteAvatar(): Observable<Account> {
    return this.http.delete<Account>(`${this.base}/avatar`);
  }

  /**
   * @param version значение для обхода кэша (обычно avatarUpdatedAt)
   */
  avatarBlob(version?: string | null): Observable<Blob> {
    let params = new HttpParams();
    if (version) params = params.set('v', version);
    return this.http.get(`${this.base}/avatar`, {
      responseType: 'blob',
      params,
    });
  }

  changePassword(req: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/password`, req);
  }
}
