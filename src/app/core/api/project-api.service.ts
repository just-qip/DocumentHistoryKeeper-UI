import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Document, Project } from '../models';

@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/projects`;

  list(page = 0, size = 50): Observable<Project[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Project[]>(this.base, { params });
  }

  get(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.base}/${id}`);
  }

  create(tenantId: string, name: string, description: string | null): Observable<Project> {
    return this.http.post<Project>(this.base, { tenantId, name, description });
  }

  listDocuments(projectId: string, page = 0, size = 100): Observable<Document[]> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Document[]>(`${this.base}/${projectId}/documents`, { params });
  }

  createDocument(
    projectId: string,
    title: string,
    docKind: string,
    file: File,
  ): Observable<Document> {
    const form = new FormData();
    form.append('title', title);
    form.append('docKind', docKind);
    form.append('file', file, file.name);
    return this.http.post<Document>(`${this.base}/${projectId}/documents`, form);
  }
}
