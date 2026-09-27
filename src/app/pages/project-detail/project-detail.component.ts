import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectApiService } from '../../core/api/project-api.service';
import { AccountDirectoryService } from '../../core/account-directory.service';
import { AppTitleService } from '../../core/app-title.service';
import { Document, Project } from '../../core/models';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.css',
})
export class ProjectDetailComponent {
  /** Ссылка на <input type="file"> для сброса после выбора/загрузки. */
  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  private readonly api = inject(ProjectApiService);
  private readonly directory = inject(AccountDirectoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(AppTitleService);

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
    this.title.set('Проект');

    this.api.get(this.projectId).subscribe({
      next: (p) => {
        this.project.set(p);
        this.title.set(`${p.name} — проект`);
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Проект не найден'),
    });
    this.reload();
    void this.directory.ensureLoaded();
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
    this.api
      .createDocument(this.projectId, this.newTitle.trim(), this.newDocKind.trim(), this.file)
      .subscribe({
        next: (d) => {
          this.documents.update((prev) => [d, ...prev]);
          this.newTitle = '';
          this.newDocKind = '';
          this.file = null;
          const input = this.fileInput()?.nativeElement;
          if (input) input.value = '';
          this.showUpload.set(false);
        },
        error: (err) => this.error.set(err?.error?.message ?? 'Ошибка загрузки файла'),
      });
  }

  /**
   * @param bytes размер в байтах
   * @returns человекочитаемый размер
   */
  humanSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  /**
   * @param id идентификатор аккаунта
   * @returns displayName или «Неизвестный аккаунт»
   */
  authorName(id: string | null | undefined): string {
    if (!id) return '—';
    return this.directory.displayName(id) ?? 'Неизвестный аккаунт';
  }
}
