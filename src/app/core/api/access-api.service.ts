import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProjectAccess, ProjectRole } from '../models';

/** Кандидат на добавление в проект. */
export interface AccessCandidate {
  accountId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

@Injectable({ providedIn: 'root' })
export class AccessApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/projects`;

  list(projectId: string): Observable<ProjectAccess[]> {
    return this.http.get<ProjectAccess[]>(`${this.base}/${projectId}/access`);
  }

  /**
   * @param projectId проект
   * @param query     подстрока поиска (email или имя)
   * @param limit     максимум результатов
   */
  searchCandidates(projectId: string, query: string, limit = 20): Observable<AccessCandidate[]> {
    const params = new HttpParams().set('q', query).set('limit', limit);
    return this.http.get<AccessCandidate[]>(`${this.base}/${projectId}/access/candidates`, {
      params,
    });
  }

  grant(projectId: string, accountId: string, role: ProjectRole): Observable<ProjectAccess> {
    return this.http.post<ProjectAccess>(`${this.base}/${projectId}/access`, {
      accountId,
      role,
    });
  }

  changeRole(projectId: string, accessId: string, role: ProjectRole): Observable<ProjectAccess> {
    return this.http.patch<ProjectAccess>(`${this.base}/${projectId}/access/${accessId}`, { role });
  }

  revoke(projectId: string, accessId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${projectId}/access/${accessId}`);
  }
}
