import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProjectAccess, ProjectRole } from '../models';

@Injectable({ providedIn: 'root' })
export class AccessApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/projects`;

  list(projectId: string): Observable<ProjectAccess[]> {
    return this.http.get<ProjectAccess[]>(`${this.base}/${projectId}/access`);
  }

  grant(projectId: string, accountId: string, role: ProjectRole): Observable<ProjectAccess> {
    return this.http.post<ProjectAccess>(`${this.base}/${projectId}/access`, { accountId, role });
  }

  changeRole(projectId: string, accessId: string, role: ProjectRole): Observable<ProjectAccess> {
    return this.http.patch<ProjectAccess>(`${this.base}/${projectId}/access/${accessId}`, { role });
  }

  revoke(projectId: string, accessId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${projectId}/access/${accessId}`);
  }
}
