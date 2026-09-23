import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Document, TimelinePage, VersionMeta } from '../models';

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

  downloadUrl(documentId: string, versionNumber: number): string {
    return `${this.base}/${documentId}/versions/${versionNumber}/content`;
  }

  /** Скачивает файл через HTTP-клиент, чтобы прошёл интерцептор с X-Account-Id. */
  download(documentId: string, versionNumber: number): Observable<Blob> {
    return this.http.get(`${this.base}/${documentId}/versions/${versionNumber}/content`, {
      responseType: 'blob',
    });
  }

  timeline(documentId: string, before?: string | null, limit = 50): Observable<TimelinePage> {
    let params = new HttpParams().set('limit', limit);
    if (before) params = params.set('before', before);
    return this.http.get<TimelinePage>(`${this.base}/${documentId}/timeline`, { params });
  }
}
