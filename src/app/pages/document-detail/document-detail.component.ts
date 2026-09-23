import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DocumentApiService } from '../../core/api/document-api.service';
import { Document, TimelineEvent, VersionMeta } from '../../core/models';

@Component({
  selector: 'app-document-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, JsonPipe, FormsModule],
  template: `
    @if (document(); as d) {
      <nav class="crumbs">
        <a routerLink="/projects">Проекты</a> /
        <a [routerLink]="['/projects', d.projectId]">проект</a> /
        <span>{{ d.title }}</span>
      </nav>
      <header class="page-head">
        <h1>{{ d.title }}</h1>
        <span class="kind">{{ d.docKind }}</span>
      </header>
    }

    @if (error()) {
      <div class="error">{{ error() }}</div>
    }

    <div class="tabs">
      <button [class.active]="tab() === 'versions'" (click)="tab.set('versions')">
        Версии ({{ versions().length }})
      </button>
      <button [class.active]="tab() === 'timeline'" (click)="tab.set('timeline')">
        Хронология
      </button>
    </div>

    @if (tab() === 'versions') {
      <div class="card">
        <form class="upload-form" (ngSubmit)="upload()">
          <div class="field">
            <label for="fileInput">Файл</label>
            <input #fileInput id="fileInput" type="file" (change)="onFile($event)" />
          </div>

          <div class="field">
            <label for="commentInput">Комментарий</label>
            <input
              id="commentInput"
              name="comment"
              [(ngModel)]="comment"
              placeholder="Правки юриста, исправление опечатки…"
            />
          </div>

          <button type="submit" [disabled]="!file">Загрузить версию</button>
        </form>

        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Файл</th>
              <th>Размер</th>
              <th>Автор</th>
              <th>Дата</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (v of versions(); track v.id) {
              <tr>
                <td>
                  <strong>v{{ v.versionNumber }}</strong>
                </td>
                <td>
                  {{ v.originalName }}
                  <div class="mime">{{ v.mimeType }}</div>
                </td>
                <td>{{ humanSize(v.sizeBytes) }}</td>
                <td>
                  <code>{{ short(v.authorId) }}</code>
                </td>
                <td>{{ v.createdAt | date: 'short' }}</td>
                <td><button class="ghost" (click)="download(v)">Скачать</button></td>
              </tr>
              @if (v.comment) {
                <tr class="comment-row">
                  <td></td>
                  <td colspan="5">💬 {{ v.comment }}</td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    }

    @if (tab() === 'timeline') {
      <div class="card timeline">
        @if (timeline().length === 0) {
          <div class="muted">Событий нет.</div>
        } @else {
          <ol>
            @for (e of timeline(); track e.id) {
              <li>
                <div class="event-head">
                  <span class="badge" [attr.data-type]="e.type">{{ e.type }}</span>
                  <span class="time">{{ e.at | date: 'medium' }}</span>
                </div>
                <div class="actor">
                  актор <code>{{ short(e.actorId) }}</code>
                </div>

                @if (eventComment(e); as comment) {
                  <div class="event-comment">💬 {{ comment }}</div>
                }

                @if (payloadWithoutComment(e); as rest) {
                  <pre>{{ rest | json }}</pre>
                }

                <div class="hash">
                  hash: <code>{{ e.eventHash }}</code>
                </div>
              </li>
            }
          </ol>
          @if (nextCursor()) {
            <button class="ghost" (click)="loadMore()">Загрузить ещё</button>
          }
        }
      </div>
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
        align-items: baseline;
        gap: 12px;
        margin-bottom: 24px;
      }
      h1 {
        margin: 0;
      }
      .kind {
        padding: 2px 8px;
        background: #e0e7ff;
        color: #3730a3;
        border-radius: 4px;
        font-size: 12px;
      }
      .tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 16px;
      }
      .tabs button {
        padding: 8px 16px;
        border: 1px solid #e2e8f0;
        background: #fff;
        border-radius: 6px;
        cursor: pointer;
        font: inherit;
      }
      .tabs button.active {
        background: #1d4ed8;
        color: #fff;
        border-color: #1d4ed8;
      }
      .card {
        background: #fff;
        border-radius: 10px;
        padding: 20px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }

      .upload-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        background: #f8fafc;
        border-radius: 8px;
        margin-bottom: 16px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .field label {
        font-size: 12px;
        font-weight: 600;
        color: #475569;
      }
      .field input {
        padding: 8px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font: inherit;
        background: #fff;
      }
      .upload-form button {
        align-self: flex-start;
        padding: 8px 16px;
        border: 0;
        border-radius: 6px;
        background: #1d4ed8;
        color: #fff;
        cursor: pointer;
        font: inherit;
      }
      .upload-form button:disabled {
        opacity: 0.5;
        cursor: default;
      }

      .table {
        width: 100%;
        border-collapse: collapse;
      }
      .table th,
      .table td {
        text-align: left;
        padding: 12px 8px;
        border-bottom: 1px solid #f1f5f9;
      }
      .table th {
        font-size: 12px;
        color: #475569;
      }
      .mime {
        font-size: 11px;
        color: #94a3b8;
      }
      .comment-row td {
        background: #f8fafc;
        font-size: 13px;
        color: #475569;
      }
      .ghost {
        padding: 6px 12px;
        background: #f1f5f9;
        color: #1d4ed8;
        border: 0;
        border-radius: 6px;
        cursor: pointer;
        font: inherit;
        font-size: 13px;
      }
      .ghost:hover {
        background: #e2e8f0;
      }
      code {
        font-size: 11px;
        color: #475569;
      }

      .timeline ol {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .timeline li {
        padding: 16px 0;
        border-bottom: 1px solid #f1f5f9;
      }
      .event-head {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .badge {
        padding: 3px 10px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        background: #e0e7ff;
        color: #3730a3;
      }
      .badge[data-type='DELETED'] {
        background: #fee2e2;
        color: #991b1b;
      }
      .badge[data-type='UPLOADED'] {
        background: #dbeafe;
        color: #1e40af;
      }
      .badge[data-type='CREATED'] {
        background: #dcfce7;
        color: #166534;
      }
      .time {
        color: #94a3b8;
        font-size: 12px;
      }
      .actor {
        font-size: 12px;
        color: #64748b;
        margin-top: 6px;
      }

      .event-comment {
        margin-top: 8px;
        padding: 8px 12px;
        background: #fef9c3;
        border-left: 3px solid #eab308;
        border-radius: 4px;
        font-size: 13px;
        color: #713f12;
      }

      .timeline pre {
        background: #f8fafc;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        margin: 8px 0 0;
        overflow-x: auto;
      }
      .hash {
        font-size: 11px;
        color: #94a3b8;
        margin-top: 6px;
      }

      .muted {
        color: #64748b;
      }
      .error {
        padding: 10px 12px;
        border-radius: 6px;
        background: #fee2e2;
        color: #991b1b;
        margin-bottom: 16px;
      }
    `,
  ],
})
export class DocumentDetailComponent {
  /** Ссылка на <input type="file">, чтобы сбрасывать значение после успешной загрузки. */
  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  private readonly api = inject(DocumentApiService);
  private readonly route = inject(ActivatedRoute);

  readonly documentId = this.route.snapshot.paramMap.get('documentId')!;
  readonly document = signal<Document | null>(null);
  readonly versions = signal<VersionMeta[]>([]);
  readonly timeline = signal<TimelineEvent[]>([]);
  readonly nextCursor = signal<string | null>(null);
  readonly tab = signal<'versions' | 'timeline'>('versions');
  readonly error = signal<string | null>(null);

  comment = '';
  file: File | null = null;

  constructor() {
    this.api.get(this.documentId).subscribe({
      next: (d) => this.document.set(d),
      error: (err) => this.error.set(err?.error?.message ?? 'Документ не найден'),
    });
    this.reloadVersions();
    this.reloadTimeline();
  }

  reloadVersions(): void {
    this.api.versions(this.documentId).subscribe({
      next: (list) => this.versions.set(list),
      error: (err) => this.error.set(err?.error?.message ?? 'Ошибка загрузки версий'),
    });
  }

  reloadTimeline(before?: string): void {
    this.api.timeline(this.documentId, before).subscribe({
      next: (page) => {
        if (before) {
          this.timeline.update((prev) => [...prev, ...page.entries]);
        } else {
          this.timeline.set(page.entries);
        }
        this.nextCursor.set(page.nextCursor);
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Ошибка загрузки хронологии'),
    });
  }

  loadMore(): void {
    const c = this.nextCursor();
    if (c) this.reloadTimeline(c);
  }

  onFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.file = input.files?.[0] ?? null;
  }

  upload(): void {
    if (!this.file) return;

    const file = this.file;
    const comment = this.comment.trim();

    this.api.uploadVersion(this.documentId, file, comment).subscribe({
      next: () => {
        this.comment = '';
        this.file = null;

        // Сброс native input, иначе повторный выбор того же файла не сработает.
        const input = this.fileInput()?.nativeElement;
        if (input) input.value = '';

        this.reloadVersions();
        this.reloadTimeline();
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Ошибка загрузки версии'),
    });
  }

  download(v: VersionMeta): void {
    this.api.download(this.documentId, v.versionNumber).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = v.originalName;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Ошибка скачивания'),
    });
  }

  humanSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  short(id: string): string {
    return id.slice(0, 8) + '…';
  }

  /**
   * Достаёт комментарий из payload события, если он там есть.
   * Старые события (до правки бэкенда) комментария не содержат — вернётся null.
   */
  eventComment(e: TimelineEvent): string | null {
    const c = e.payload?.['comment'];
    return typeof c === 'string' && c.trim() ? c : null;
  }

  /**
   * Возвращает payload без поля comment — чтобы в JSON-блоке
   * не дублировать то, что уже показано отдельной плашкой.
   * Если после удаления comment полей не осталось — возвращает null.
   */
  payloadWithoutComment(e: TimelineEvent): Record<string, unknown> | null {
    if (!e.payload) return null;
    const { comment, ...rest } = e.payload as Record<string, unknown>;
    return Object.keys(rest).length > 0 ? rest : null;
  }
}
