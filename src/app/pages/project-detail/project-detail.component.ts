import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectApiService } from '../../core/api/project-api.service';
import { Document, Project } from '../../core/models';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  template: `
    @if (project(); as p) {
      <nav class="crumbs">
        <a routerLink="/projects">Проекты</a> / <span>{{ p.name }}</span>
      </nav>
      <header class="page-head">
        <h1>{{ p.name }}</h1>
        <button (click)="showUpload.set(!showUpload())">
          {{ showUpload() ? 'Отмена' : '+ Загрузить документ' }}
        </button>
      </header>
      @if (p.description) {
        <p class="desc">{{ p.description }}</p>
      }
    }

    @if (error()) {
      <div class="error">{{ error() }}</div>
    }

    @if (showUpload()) {
      <div class="card upload">
        <input [(ngModel)]="newTitle" placeholder="Заголовок" />
        <input [(ngModel)]="newDocKind" placeholder="Тип (CONTRACT, INVOICE, …)" />
        <input type="file" (change)="onFile($event)" />
        <button (click)="upload()" [disabled]="!newTitle.trim() || !newDocKind.trim() || !file">
          Загрузить
        </button>
      </div>
    }

    @if (loading()) {
      <div class="muted">Загрузка…</div>
    } @else if (documents().length === 0) {
      <div class="empty">В проекте пока нет документов.</div>
    } @else {
      <table class="table">
        <thead>
          <tr>
            <th>Заголовок</th>
            <th>Тип</th>
            <th>Обновлён</th>
          </tr>
        </thead>
        <tbody>
          @for (d of documents(); track d.id) {
            <tr>
              <td>
                <a [routerLink]="['/projects', projectId, 'documents', d.id]">
                  {{ d.title }}
                </a>
              </td>
              <td>{{ d.docKind }}</td>
              <td>{{ d.updatedAt | date: 'short' }}</td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
  styles: [
    `
      .crumbs {
        font-size: 13px;
        color: #64748b;
        margin-bottom: 8px;
      }
      .crumbs a {
        color: #1d4ed8;
        text-decoration: none;
      }
      .page-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      h1 {
        margin: 0;
      }
      .desc {
        color: #475569;
        margin: 8px 0 24px;
      }
      button {
        padding: 8px 14px;
        border: 0;
        border-radius: 6px;
        background: #1d4ed8;
        color: #fff;
        cursor: pointer;
        font: inherit;
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .card {
        background: #fff;
        border-radius: 10px;
        padding: 20px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }
      .upload {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 16px 0;
      }
      .upload input {
        padding: 8px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font: inherit;
      }
      .table {
        width: 100%;
        background: #fff;
        border-radius: 10px;
        overflow: hidden;
        border-collapse: collapse;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }
      .table th,
      .table td {
        text-align: left;
        padding: 12px 16px;
        border-bottom: 1px solid #f1f5f9;
      }
      .table th {
        background: #f8fafc;
        font-weight: 600;
        font-size: 13px;
        color: #475569;
      }
      .table a {
        color: #1d4ed8;
        text-decoration: none;
        font-weight: 500;
      }
      .table a:hover {
        text-decoration: underline;
      }
      .muted {
        color: #64748b;
      }
      .empty {
        color: #64748b;
        padding: 40px;
        text-align: center;
        background: #fff;
        border-radius: 10px;
      }
      .error {
        padding: 10px 12px;
        border-radius: 6px;
        background: #fee2e2;
        color: #991b1b;
        margin: 16px 0;
      }
    `,
  ],
})
export class ProjectDetailComponent {
  private readonly api = inject(ProjectApiService);
  private readonly route = inject(ActivatedRoute);

  readonly projectId = this.route.snapshot.paramMap.get('projectId')!;
  readonly project = signal<Project | null>(null);
  readonly documents = signal<Document[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showUpload = signal(false);

  newTitle = '';
  newDocKind = '';
  file: File | null = null;

  constructor() {
    this.api.get(this.projectId).subscribe({
      next: (p) => this.project.set(p),
      error: (err) => this.error.set(err?.error?.message ?? 'Проект не найден'),
    });
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.listDocuments(this.projectId).subscribe({
      next: (list) => {
        this.documents.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Ошибка загрузки документов');
        this.loading.set(false);
      },
    });
  }

  onFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.file = input.files?.[0] ?? null;
  }

  upload(): void {
    if (!this.file) return;
    this.api
      .createDocument(this.projectId, this.newTitle.trim(), this.newDocKind.trim(), this.file)
      .subscribe({
        next: (d) => {
          this.documents.update((prev) => [d, ...prev]);
          this.newTitle = '';
          this.newDocKind = '';
          this.file = null;
          this.showUpload.set(false);
        },
        error: (err) => this.error.set(err?.error?.message ?? 'Ошибка загрузки файла'),
      });
  }
}
