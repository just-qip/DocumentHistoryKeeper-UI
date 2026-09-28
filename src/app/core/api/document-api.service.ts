import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AccessAction,
  AccessLogPage,
  AccessLogStats,
  Document,
  TimelinePage,
  VersionMeta,
} from '../models';

@Injectable({ providedIn: 'root' })
export class DocumentApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/documents`;

  get(id: string): Observable<Document> {
    return this.http.get<Document>(`${this.base}/${id}`);
  }

  update(id: string, patch: { title?: string; docKind?: string }): Observable<Document> {
    return this.http.patch<Document>(`${this.base}/${id}`, patch);
  }

  delete(id: string, reason?: string): Observable<void> {
    let params = new HttpParams();
    if (reason) params = params.set('reason', reason);
    return this.http.delete<void>(`${this.base}/${id}`, { params });
  }

  versions(documentId: string): Observable<VersionMeta[]> {
    return this.http.get<VersionMeta[]>(`${this.base}/${documentId}/versions`);
  }

  uploadVersion(documentId: string, file: File, comment: string): Observable<VersionMeta> {
    const form = new FormData();
    form.append('file', file, file.name);
    if (comment) form.append('comment', comment);
    return this.http.post<VersionMeta>(`${this.base}/${documentId}/versions`, form);
  }

  /**
   * @param documentId документ
   * @param versionNumber версия
   * @param mode preview | download (влияет на аудит и Content-Disposition)
   */
  download(
    documentId: string,
    versionNumber: number,
    mode: 'preview' | 'download' = 'download',
  ): Observable<Blob> {
    const params = new HttpParams().set('mode', mode);
    return this.http.get(`${this.base}/${documentId}/versions/${versionNumber}/content`, {
      responseType: 'blob',
      params,
    });
  }

  timeline(documentId: string, before?: string | null, limit = 50): Observable<TimelinePage> {
    let params = new HttpParams().set('limit', limit);
    if (before) params = params.set('before', before);
    return this.http.get<TimelinePage>(`${this.base}/${documentId}/timeline`, { params });
  }

  /**
   * @param documentId     документ
   * @param filters        action / accountId / versionId / withoutVersion / before / limit
   */
  audit(
    documentId: string,
    filters: {
      action?: AccessAction | null;
      accountId?: string | null;
      versionId?: string | null;
      withoutVersion?: boolean;
      before?: string | null;
      limit?: number;
    } = {},
  ): Observable<AccessLogPage> {
    let params = new HttpParams().set('limit', filters.limit ?? 50);
    if (filters.action) params = params.set('action', filters.action);
    if (filters.accountId) params = params.set('accountId', filters.accountId);
    if (filters.withoutVersion) {
      params = params.set('withoutVersion', 'true');
    } else if (filters.versionId) {
      params = params.set('versionId', filters.versionId);
    }
    if (filters.before) params = params.set('before', filters.before);
    return this.http.get<AccessLogPage>(`${this.base}/${documentId}/audit`, { params });
  }

  auditStats(documentId: string): Observable<AccessLogStats> {
    return this.http.get<AccessLogStats>(`${this.base}/${documentId}/audit/stats`);
  }
}
