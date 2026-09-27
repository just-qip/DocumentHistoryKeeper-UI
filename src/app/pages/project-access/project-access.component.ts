import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { ProjectApiService } from '../../core/api/project-api.service';
import { AccessApiService, AccessCandidate } from '../../core/api/access-api.service';
import { AppTitleService } from '../../core/app-title.service';
import { environment } from '../../../environments/environment';
import { Project, ProjectAccess, ProjectRole } from '../../core/models';

/** Минимальная длина запроса для поиска. */
const MIN_QUERY_LENGTH = 2;

@Component({
  selector: 'app-project-access',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  templateUrl: './project-access.component.html',
  styleUrl: './project-access.component.css',
})
export class ProjectAccessComponent {
  private readonly projectsApi = inject(ProjectApiService);
  private readonly accessApi = inject(AccessApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(AppTitleService);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectId = this.route.snapshot.paramMap.get('projectId')!;
  readonly project = signal<Project | null>(null);
  readonly accesses = signal<ProjectAccess[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly showGrant = signal(false);

  /** Строка поиска кандидатов. */
  candidateQuery = '';
  /** Результаты поиска. */
  readonly candidates = signal<AccessCandidate[]>([]);
  /** Идёт поиск. */
  readonly searching = signal(false);
  /** Поиск уже отработал хотя бы раз для текущего запроса. */
  readonly searched = signal(false);
  /** Кандидат выбран. */
  readonly selectedCandidate = signal<AccessCandidate | null>(null);

  newRole: ProjectRole = 'VIEWER';

  private readonly search$ = new Subject<string>();

  readonly canManage = computed(() => {
    const r = this.project()?.myRole;
    return r === 'ADMIN' || r === 'OWNER';
  });

  /** Короткая подсказка под полем — когда ещё рано искать. */
  readonly queryTooShort = computed(() => {
    const q = this.candidateQuery.trim();
    return !this.selectedCandidate() && q.length > 0 && q.length < MIN_QUERY_LENGTH;
  });

  constructor() {
    this.title.set('Участники проекта');

    this.projectsApi.get(this.projectId).subscribe({
      next: (p) => {
        this.project.set(p);
        this.title.set(`Участники · ${p.name}`);
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Проект не найден'),
    });

    this.search$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => {
          const trimmed = q.trim();
          // Не бьём в сервер пустым или коротким запросом.
          if (trimmed.length < MIN_QUERY_LENGTH) {
            this.searching.set(false);
            this.searched.set(false);
            this.candidates.set([]);
            return of<AccessCandidate[]>([]);
          }
          this.searching.set(true);
          return this.accessApi.searchCandidates(this.projectId, trimmed);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (list) => {
          // Пустой ответ от «короткого» запроса не должен стирать
          // результаты предыдущего валидного — но у нас switchMap
          // гарантирует, что остался только актуальный.
          if (list.length || this.candidateQuery.trim().length >= MIN_QUERY_LENGTH) {
            this.candidates.set(list);
            this.searched.set(true);
          }
          this.searching.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Ошибка поиска');
          this.searching.set(false);
        },
      });

    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.accessApi.list(this.projectId).subscribe({
      next: (list) => {
        this.accesses.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Ошибка загрузки участников');
        this.loading.set(false);
      },
    });
  }

  /**
   * Обработчик ввода в поле поиска.
   *
   * @param value новое значение
   */
  onQueryInput(value: string): void {
    this.candidateQuery = value;
    this.selectedCandidate.set(null);
    this.search$.next(value);
  }

  /** Открыть/закрыть панель добавления. */
  toggleGrant(): void {
    const next = !this.showGrant();
    this.showGrant.set(next);
    if (!next) this.resetGrantForm();
    // При открытии НЕ запускаем поиск — ждём ввода пользователя.
  }

  /**
   * @param c выбранный кандидат
   */
  pickCandidate(c: AccessCandidate): void {
    this.selectedCandidate.set(c);
    this.candidateQuery = c.displayName;
    this.candidates.set([]);
    this.searched.set(false);
  }

  /**
   * @param c кандидат
   * @returns полный URL аватара или null
   */
  candidateAvatar(c: AccessCandidate): string | null {
    if (!c.avatarUrl) return null;
    return `${environment.apiBaseUrl}${c.avatarUrl}`;
  }

  grant(): void {
    const c = this.selectedCandidate();
    if (!c) return;
    this.accessApi.grant(this.projectId, c.accountId, this.newRole).subscribe({
      next: (pa) => {
        this.accesses.update((prev) => [...prev, pa]);
        this.resetGrantForm();
        this.showGrant.set(false);
        this.flash('Доступ выдан');
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Ошибка выдачи доступа'),
    });
  }

  changeRole(a: ProjectAccess, role: ProjectRole): void {
    this.accessApi.changeRole(this.projectId, a.id, role).subscribe({
      next: (updated) => {
        this.accesses.update((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        this.flash('Роль обновлена');
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Ошибка смены роли');
        this.reload();
      },
    });
  }

  revoke(a: ProjectAccess): void {
    if (!confirm(`Убрать из проекта ${a.accountName}?`)) return;
    this.accessApi.revoke(this.projectId, a.id).subscribe({
      next: () => {
        this.accesses.update((prev) => prev.filter((x) => x.id !== a.id));
        this.flash('Доступ отозван');
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Ошибка отзыва'),
    });
  }

  avatarSrc(a: ProjectAccess): string | null {
    if (!a.accountAvatarUrl) return null;
    return `${environment.apiBaseUrl}${a.accountAvatarUrl}`;
  }

  initial(a: ProjectAccess): string {
    const n = a.accountName?.trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  }

  candidateInitial(c: AccessCandidate): string {
    const n = c.displayName?.trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  }

  private resetGrantForm(): void {
    this.candidateQuery = '';
    this.candidates.set([]);
    this.selectedCandidate.set(null);
    this.searched.set(false);
    this.searching.set(false);
    this.newRole = 'VIEWER';
  }

  private flash(msg: string): void {
    this.success.set(msg);
    setTimeout(() => this.success.set(null), 2500);
  }
}
