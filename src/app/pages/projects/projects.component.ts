import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectApiService } from '../../core/api/project-api.service';
import { Project } from '../../core/models';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  template: `
    <header class="page-head">
      <div>
        <h1>Проекты</h1>
        @if (!loading() && projects().length > 0) {
          <p class="subtitle">{{ projects().length }} шт.</p>
        }
      </div>
      <button class="primary" (click)="showCreate.set(!showCreate())">
        {{ showCreate() ? 'Отмена' : '+ Новый проект' }}
      </button>
    </header>

    @if (error()) {
      <div class="error">{{ error() }}</div>
    }

    @if (showCreate()) {
      <div class="create-card">
        <input [(ngModel)]="newName" placeholder="Название проекта" />
        <input [(ngModel)]="newDescription" placeholder="Описание (опционально)" />
        <button class="primary" (click)="create()" [disabled]="!newName.trim()">Создать</button>
      </div>
    }

    @if (loading()) {
      <div class="muted">Загрузка…</div>
    } @else if (projects().length === 0) {
      <div class="empty">
        <div class="empty-title">Пока нет проектов</div>
        <div class="empty-hint">Создайте первый, чтобы начать работу с документами.</div>
      </div>
    } @else {
      <div class="grid">
        @for (p of projects(); track p.id) {
          <a class="project-card" [routerLink]="['/projects', p.id]">
            <div class="project-accent"></div>
            <div class="project-body">
              <h2>{{ p.name }}</h2>
              @if (p.description) {
                <p class="project-desc">{{ p.description }}</p>
              } @else {
                <p class="project-desc muted-desc">Без описания</p>
              }
              <div class="project-meta">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>{{ p.createdAt | date: 'd MMM yyyy' }}</span>
              </div>
            </div>
          </a>
        }
      </div>
    }
  `,
  styles: [
    `
      .page-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 32px;
        gap: 16px;
      }
      h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.3px;
      }
      .subtitle {
        margin: 4px 0 0;
        color: #64748b;
        font-size: 13px;
      }
      .primary {
        padding: 10px 20px;
        border: 0;
        border-radius: 8px;
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: #fff;
        cursor: pointer;
        font: inherit;
        font-weight: 500;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
        transition:
          transform 0.1s,
          box-shadow 0.15s;
      }
      .primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
      }
      .primary:disabled {
        opacity: 0.5;
        cursor: default;
        transform: none;
        box-shadow: none;
      }
      .create-card {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 24px;
        background: #fff;
        border-radius: 12px;
        margin-bottom: 24px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }
      .create-card input {
        padding: 10px 14px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font: inherit;
        font-size: 14px;
      }
      .create-card input:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
      }
      .create-card button {
        align-self: flex-start;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
        gap: 24px;
      }
      .project-card {
        display: block;
        background: #fff;
        border-radius: 14px;
        overflow: hidden;
        text-decoration: none;
        color: inherit;
        box-shadow:
          0 1px 3px rgba(0, 0, 0, 0.05),
          0 1px 2px rgba(0, 0, 0, 0.03);
        transition:
          transform 0.15s,
          box-shadow 0.2s;
        min-height: 180px;
        position: relative;
      }
      .project-card:hover {
        transform: translateY(-3px);
        box-shadow:
          0 12px 28px rgba(15, 23, 42, 0.1),
          0 4px 10px rgba(15, 23, 42, 0.06);
      }
      .project-accent {
        height: 4px;
        background: linear-gradient(90deg, #2563eb, #60a5fa);
      }
      .project-body {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        height: calc(100% - 4px);
      }
      .project-body h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #0f172a;
        letter-spacing: -0.2px;
      }
      .project-desc {
        margin: 0;
        color: #475569;
        font-size: 14px;
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .muted-desc {
        color: #94a3b8;
        font-style: italic;
      }
      .project-meta {
        margin-top: auto;
        display: flex;
        align-items: center;
        gap: 6px;
        color: #94a3b8;
        font-size: 12px;
        padding-top: 12px;
      }
      .project-meta svg {
        width: 14px;
        height: 14px;
      }
      .empty {
        padding: 64px 40px;
        text-align: center;
        background: #fff;
        border-radius: 14px;
        border: 1px dashed #e2e8f0;
      }
      .empty-title {
        font-size: 16px;
        font-weight: 600;
        color: #334155;
      }
      .empty-hint {
        color: #64748b;
        font-size: 14px;
        margin-top: 6px;
      }
      .muted {
        color: #64748b;
      }
      .error {
        padding: 12px 16px;
        border-radius: 8px;
        background: #fef2f2;
        color: #991b1b;
        border: 1px solid #fecaca;
        margin-bottom: 16px;
        font-size: 14px;
      }
    `,
  ],
})
export class ProjectsComponent {
  private readonly api = inject(ProjectApiService);

  readonly projects = signal<Project[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showCreate = signal(false);

  newName = '';
  newDescription = '';

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (list) => {
        this.projects.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Ошибка загрузки');
        this.loading.set(false);
      },
    });
  }

  create(): void {
    const name = this.newName.trim();
    if (!name) return;
    this.api.create(name, this.newDescription.trim() || null).subscribe({
      next: (p) => {
        this.projects.update((prev) => [p, ...prev]);
        this.newName = '';
        this.newDescription = '';
        this.showCreate.set(false);
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Ошибка создания'),
    });
  }
}
