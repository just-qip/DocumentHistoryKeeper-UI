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
import { ProjectApiService } from '../../core/api/project-api.service';
import { AccountDirectoryService } from '../../core/account-directory.service';
import { AppTitleService } from '../../core/app-title.service';
import {
  AccessAction,
  AccessLogEntry,
  AccessLogStats,
  DeniedReason,
  Document,
  TimelineEvent,
  VersionMeta,
} from '../../core/models';

type PreviewMode = 'text' | 'image' | 'pdf' | 'video' | 'audio' | 'unknown';
type Tab = 'versions' | 'timeline' | 'audit';

const VERSION_FILTER_NONE = '__none__';

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
  private readonly projectsApi = inject(ProjectApiService);
  private readonly directory = inject(AccountDirectoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(AppTitleService);

  readonly documentId = this.route.snapshot.paramMap.get('documentId')!;
  readonly document = signal<Document | null>(null);
  readonly versions = signal<VersionMeta[]>([]);
  readonly timeline = signal<TimelineEvent[]>([]);
  readonly nextCursor = signal<string | null>(null);
  readonly tab = signal<Tab>('versions');
  readonly error = signal<string | null>(null);

  readonly canViewAudit = signal(false);

  /* ---------- Аудит ---------- */

  readonly auditEntries = signal<AccessLogEntry[]>([]);
  readonly auditStats = signal<AccessLogStats | null>(null);
  readonly auditLoading = signal(false);

  /** Номер страницы (1-based для UI). */
  readonly auditPage = signal(1);
  /** Размер страницы. */
  readonly auditPageSize = signal(50);
  /** Всего страниц. */
  readonly auditTotalPages = signal(0);
  /** Всего записей. */
  readonly auditTotalElements = signal(0);

  /** Доступные размеры страницы. */
  readonly pageSizes = [25, 50, 100, 200];

  readonly VERSION_NONE = VERSION_FILTER_NONE;
  auditActionFilter: AccessAction | '' = '';
  auditVersionFilter: string = '';
  auditDeniedOnly = false;

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
    this.title.set('Документ');

    effect((onCleanup) => {
      if (this.previewOpen()) {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        onCleanup(() => {
          document.body.style.overflow = prev;
        });
      }
    });

    this.destroyRef.onDestroy(() => this.revokePreviewUrl());

    this.api.get(this.documentId).subscribe({
      next: (d) => {
        this.document.set(d);
        this.title.set(`${d.title} — документ`);
        this.projectsApi.get(d.projectId).subscribe({
          next: (p) => {
            const r = p.myRole;
            this.canViewAudit.set(r === 'ADMIN' || r === 'OWNER');
          },
          error: () => this.canViewAudit.set(false),
        });
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Документ не найден'),
    });
    this.reloadVersions();
    this.reloadTimeline();
    void this.directory.ensureLoaded();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.previewOpen()) this.closePreview();
  }

  stopPropagation(e: Event): void {
    e.stopPropagation();
  }

  /* ---------- Версии / таймлайн ---------- */

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

  loadMoreTimeline(): void {
    const c = this.nextCursor();
    if (c) this.reloadTimeline(c);
  }

  /* ---------- Аудит ---------- */

  onTabChange(next: Tab): void {
    this.tab.set(next);
    if (next === 'audit' && this.canViewAudit() && !this.auditStats()) {
      this.reloadAudit();
      this.reloadAuditStats();
    }
  }

  /** Загрузка текущей страницы (или указанной). */
  reloadAudit(page?: number): void {
    const target = page ?? this.auditPage();
    this.auditLoading.set(true);

    const filter = this.auditVersionFilter;
    this.api
      .audit(this.documentId, {
        action: this.auditActionFilter || null,
        versionId: filter && filter !== VERSION_FILTER_NONE ? filter : null,
        withoutVersion: filter === VERSION_FILTER_NONE,
        deniedOnly: this.auditDeniedOnly,
        page: target - 1, // API принимает 0-based
        size: this.auditPageSize(),
      })
      .subscribe({
        next: (p) => {
          this.auditEntries.set(p.entries);
          this.auditPage.set(p.page + 1);
          this.auditTotalPages.set(p.totalPages);
          this.auditTotalElements.set(p.totalElements);
          this.auditLoading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Ошибка загрузки журнала');
          this.auditLoading.set(false);
        },
      });
  }

  reloadAuditStats(): void {
    this.api.auditStats(this.documentId).subscribe({
      next: (s) => this.auditStats.set(s),
      error: () => this.auditStats.set(null),
    });
  }

  /* ---------- Пагинация ---------- */

  goToPage(n: number): void {
    const target = Math.min(Math.max(n, 1), Math.max(this.auditTotalPages(), 1));
    if (target === this.auditPage()) return;
    this.reloadAudit(target);
  }

  nextPage(): void {
    this.goToPage(this.auditPage() + 1);
  }
  prevPage(): void {
    this.goToPage(this.auditPage() - 1);
  }
  firstPage(): void {
    this.goToPage(1);
  }
  lastPage(): void {
    this.goToPage(this.auditTotalPages() || 1);
  }

  changePageSize(size: number): void {
    this.auditPageSize.set(size);
    this.reloadAudit(1);
  }

  /**
   * Список номеров страниц вокруг текущей для рендера кнопок.
   * Возвращает до 7 номеров: 1, …, n-1, n, n+1, …, last.
   */
  visiblePages(): (number | '...')[] {
    const total = this.auditTotalPages();
    if (total <= 1) return [];
    const cur = this.auditPage();
    const result: (number | '...')[] = [];

    const push = (n: number | '...') => {
      if (result[result.length - 1] !== n) result.push(n);
    };

    push(1);
    if (cur > 3) push('...');
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) {
      push(i);
    }
    if (cur < total - 2) push('...');
    if (total > 1) push(total);

    return result;
  }

  /* ---------- Фильтры ---------- */

  applyAuditFilters(): void {
    this.reloadAudit(1);
  }

  clearAuditFilters(): void {
    this.auditActionFilter = '';
    this.auditVersionFilter = '';
    this.auditDeniedOnly = false;
    this.reloadAudit(1);
  }

  /* ---------- Файл ---------- */

  onFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.file = input.files?.[0] ?? null;
  }

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

  /* ---------- Скачивание / предпросмотр ---------- */

  download(v: VersionMeta): void {
    this.api.download(this.documentId, v.versionNumber, 'download').subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = v.originalName;
        a.click();
        URL.revokeObjectURL(url);
        if (this.tab() === 'audit') this.reloadAudit();
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Ошибка скачивания'),
    });
  }

  async openPreview(v: VersionMeta): Promise<void> {
    this.revokePreviewUrl();
    this.previewVersion.set(v);
    this.previewMode.set(this.detectMode(v.mimeType));
    this.previewText.set(null);
    this.previewError.set(null);
    this.previewLoading.set(true);
    this.previewOpen.set(true);

    try {
      const blob = await firstValueFrom(
        this.api.download(this.documentId, v.versionNumber, 'preview'),
      );

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

  closePreview(): void {
    this.previewOpen.set(false);
    this.previewVersion.set(null);
    this.previewText.set(null);
    this.previewError.set(null);
    this.revokePreviewUrl();
  }

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

  private revokePreviewUrl(): void {
    const url = this.previewBlobUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.previewBlobUrl.set(null);
    }
  }

  /* ---------- Хелперы ---------- */

  humanSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  authorName(id: string | null | undefined): string {
    if (!id) return '—';
    return this.directory.displayName(id) ?? 'Неизвестный аккаунт';
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

  actionLabel(a: AccessAction): string {
    switch (a) {
      case 'VIEW':
        return 'Просмотр';
      case 'PREVIEW':
        return 'Предпросмотр';
      case 'DOWNLOAD':
        return 'Скачивание';
    }
  }

  deniedReasonLabel(r: DeniedReason): string {
    switch (r) {
      case 'NO_SESSION':
        return 'Без сессии';
      case 'INVALID_SESSION':
        return 'Невалидный токен';
      case 'NO_ACCESS':
        return 'Нет доступа';
      case 'NOT_FOUND':
        return 'Не найден';
    }
  }

  deviceIcon(t: string | null): string {
    switch (t) {
      case 'mobile':
        return '📱';
      case 'tablet':
        return '📲';
      case 'bot':
        return '🤖';
      case 'desktop':
        return '💻';
      default:
        return '❔';
    }
  }

  clientLabel(e: AccessLogEntry): string {
    const parts: string[] = [];
    if (e.osName) parts.push(e.osName);
    if (e.browserName) parts.push(e.browserName);
    return parts.join(' · ') || '—';
  }

  versionLabel(versionNumber: number | null): string {
    return versionNumber == null ? 'Документ' : `v${versionNumber}`;
  }

  isDenied(e: AccessLogEntry): boolean {
    return e.deniedReason != null;
  }
}
