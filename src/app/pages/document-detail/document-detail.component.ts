import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { DocumentApiService } from '../../core/api/document-api.service';
import { AccountDirectoryService } from '../../core/account-directory.service';
import { Document, TimelineEvent, VersionMeta } from '../../core/models';

/** Режим отображения предпросмотра, вычисляется по MIME. */
type PreviewMode = 'text' | 'image' | 'pdf' | 'video' | 'audio' | 'unknown';

@Component({
  selector: 'app-document-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, JsonPipe, FormsModule],
  templateUrl: './document-detail.component.html',
  styleUrl: './document-detail.component.css',
})
export class DocumentDetailComponent {
  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  private readonly api = inject(DocumentApiService);
  private readonly directory = inject(AccountDirectoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly documentId = this.route.snapshot.paramMap.get('documentId')!;
  readonly document = signal<Document | null>(null);
  readonly versions = signal<VersionMeta[]>([]);
  readonly timeline = signal<TimelineEvent[]>([]);
  readonly nextCursor = signal<string | null>(null);
  readonly tab = signal<'versions' | 'timeline'>('versions');
  readonly error = signal<string | null>(null);

  /* ---------- Модальное окно предпросмотра ---------- */

  readonly previewOpen = signal(false);
  readonly previewVersion = signal<VersionMeta | null>(null);
  readonly previewMode = signal<PreviewMode>('unknown');
  readonly previewBlobUrl = signal<string | null>(null);
  readonly previewText = signal<string | null>(null);
  readonly previewLoading = signal(false);
  readonly previewError = signal<string | null>(null);

  comment = '';
  file: File | null = null;

  constructor() {
    // Блокируем скролл body, пока модалка открыта.
    effect((onCleanup) => {
      if (this.previewOpen()) {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        onCleanup(() => {
          document.body.style.overflow = prev;
        });
      }
    });

    // Отзываем blob-URL при разрушении компонента, чтобы не текла память.
    this.destroyRef.onDestroy(() => this.revokePreviewUrl());

    this.api.get(this.documentId).subscribe({
      next: (d) => this.document.set(d),
      error: (err) => this.error.set(err?.error?.message ?? 'Документ не найден'),
    });
    this.reloadVersions();
    this.reloadTimeline();
    void this.directory.ensureLoaded();
  }

  /** Escape закрывает модалку. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.previewOpen()) this.closePreview();
  }

  /** Останавливает всплытие клика, чтобы клик по карточке модалки не закрывал её. */
  stopPropagation(e: Event): void {
    e.stopPropagation();
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

  /**
   * Очищает выбранный файл и сбрасывает значение нативного input,
   * чтобы повторный выбор того же файла срабатывал.
   */
  clearFile(): void {
    this.file = null;
    const input = this.fileInput()?.nativeElement;
    if (input) input.value = '';
  }

  upload(): void {
    if (!this.file) return;

    const file = this.file;
    const comment = this.comment.trim();

    this.api.uploadVersion(this.documentId, file, comment).subscribe({
      next: () => {
        this.comment = '';
        this.file = null;
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

  /** Открывает модалку и загружает контент версии для предпросмотра. */
  async openPreview(v: VersionMeta): Promise<void> {
    this.revokePreviewUrl();
    this.previewVersion.set(v);
    this.previewMode.set(this.detectMode(v.mimeType));
    this.previewText.set(null);
    this.previewError.set(null);
    this.previewLoading.set(true);
    this.previewOpen.set(true);

    try {
      const blob = await firstValueFrom(this.api.download(this.documentId, v.versionNumber));

      if (this.previewMode() === 'text') {
        const text = await blob.text();
        this.previewText.set(text);
      } else if (this.previewMode() !== 'unknown') {
        this.previewBlobUrl.set(URL.createObjectURL(blob));
      }
    } catch (err: unknown) {
      const msg =
        (err as { error?: { message?: string } })?.error?.message ?? 'Не удалось загрузить файл';
      this.previewError.set(msg);
    } finally {
      this.previewLoading.set(false);
    }
  }

  /** Закрывает модалку и освобождает ресурсы. */
  closePreview(): void {
    this.previewOpen.set(false);
    this.previewVersion.set(null);
    this.previewText.set(null);
    this.previewError.set(null);
    this.revokePreviewUrl();
  }

  /** Определяет режим предпросмотра по MIME. */
  private detectMode(mime: string): PreviewMode {
    if (!mime) return 'unknown';
    const m = mime.toLowerCase();
    if (
      m.startsWith('text/') ||
      m === 'application/json' ||
      m === 'application/xml' ||
      m.endsWith('+xml')
    )
      return 'text';
    if (m.startsWith('image/')) return 'image';
    if (m === 'application/pdf') return 'pdf';
    if (m.startsWith('video/')) return 'video';
    if (m.startsWith('audio/')) return 'audio';
    return 'unknown';
  }

  /** Отзывает текущий blob URL, если он есть. */
  private revokePreviewUrl(): void {
    const url = this.previewBlobUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.previewBlobUrl.set(null);
    }
  }

  humanSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  authorName(id: string | null | undefined): string {
    if (!id) return '—';
    return this.directory.displayName(id) ?? 'Неизвестный аккаунт';
  }

  authorTenant(id: string | null | undefined): string | null {
    return this.directory.tenantId(id);
  }

  eventComment(e: TimelineEvent): string | null {
    const c = e.payload?.['comment'];
    return typeof c === 'string' && c.trim() ? c : null;
  }

  payloadWithoutComment(e: TimelineEvent): Record<string, unknown> | null {
    if (!e.payload) return null;
    const { comment, ...rest } = e.payload as Record<string, unknown>;
    return Object.keys(rest).length > 0 ? rest : null;
  }
}
