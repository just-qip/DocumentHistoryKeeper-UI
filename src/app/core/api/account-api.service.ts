import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Account } from '../models';

@Injectable({ providedIn: 'root' })
export class AccountApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/accounts`;

  list(page = 0, size = 500): Observable<Account[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Account[]>(this.base, { params });
  }

  get(id: string): Observable<Account> {
    return this.http.get<Account>(`${this.base}/${id}`);
  }

  create(email: string, displayName: string): Observable<Account> {
    return this.http.post<Account>(this.base, { email, displayName });
  }
}
