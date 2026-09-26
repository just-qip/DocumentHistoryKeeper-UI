import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectApiService } from '../../core/api/project-api.service';
import { AccessApiService } from '../../core/api/access-api.service';
import { AccountDirectoryService } from '../../core/account-directory.service';
import { Project, ProjectAccess, ProjectRole } from '../../core/models';

@Component({
  selector: 'app-access-admin',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './access-admin.component.html',
  styleUrl: './access-admin.component.css',
})
export class AccessAdminComponent {
  private readonly projectsApi = inject(ProjectApiService);
  private readonly accessApi = inject(AccessApiService);
  private readonly directory = inject(AccountDirectoryService);

  readonly projects = signal<Project[]>([]);
  readonly accesses = signal<ProjectAccess[]>([]);
  readonly selectedProject = signal<Project | null>(null);
  readonly showGrant = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  newAccountId = '';
  newRole: ProjectRole = 'VIEWER';

  /**
   * Кандидаты на доступ: аккаунты, которым ещё не выдан доступ к выбранному проекту.
   */
  readonly candidateAccounts = computed(() => {
    const taken = new Set(this.accesses().map((a) => a.accountId));
    return Array.from(this.directory.byId().values())
      .filter((a) => !taken.has(a.id))
      .sort((x, y) => x.displayName.localeCompare(y.displayName));
  });

  constructor() {
    this.projectsApi.list().subscribe({
      next: (list) => this.projects.set(list),
      error: (err) => this.error.set(err?.error?.message ?? 'Ошибка загрузки проектов'),
    });
    void this.directory.ensureLoaded();
  }

  select(p: Project): void {
    this.selectedProject.set(p);
    this.showGrant.set(false);
    this.newAccountId = '';
    this.reloadAccesses(p.id);
  }

  reloadAccesses(projectId: string): void {
    this.loading.set(true);
    this.accessApi.list(projectId).subscribe({
      next: (list) => {
        this.accesses.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Ошибка загрузки доступов');
        this.loading.set(false);
      },
    });
  }

  grant(): void {
    const p = this.selectedProject();
    if (!p || !this.newAccountId) return;
    this.accessApi.grant(p.id, this.newAccountId, this.newRole).subscribe({
      next: (pa) => {
        this.accesses.update((prev) => [...prev, pa]);
        this.newAccountId = '';
        this.newRole = 'VIEWER';
        this.showGrant.set(false);
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Ошибка выдачи доступа'),
    });
  }

  changeRole(a: ProjectAccess, role: ProjectRole): void {
    const p = this.selectedProject();
    if (!p) return;
    this.accessApi.changeRole(p.id, a.id, role).subscribe({
      next: (updated) => {
        this.accesses.update((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Ошибка смены роли'),
    });
  }

  revoke(a: ProjectAccess): void {
    const p = this.selectedProject();
    if (!p) return;
    if (!confirm(`Отозвать доступ у ${this.accountName(a.accountId)}?`)) return;
    this.accessApi.revoke(p.id, a.id).subscribe({
      next: () => this.accesses.update((prev) => prev.filter((x) => x.id !== a.id)),
      error: (err) => this.error.set(err?.error?.message ?? 'Ошибка отзыва'),
    });
  }

  /**
   * @param id идентификатор аккаунта
   * @returns displayName или короткий UUID
   */
  accountName(id: string): string {
    return this.directory.displayName(id) ?? this.shortId(id);
  }

  /**
   * @param id идентификатор аккаунта
   * @returns email или пустая строка
   */
  accountEmail(id: string): string {
    return this.directory.email(id) ?? '';
  }

  private shortId(id: string): string {
    return id.length > 8 ? `${id.slice(0, 8)}…` : id;
  }
}
