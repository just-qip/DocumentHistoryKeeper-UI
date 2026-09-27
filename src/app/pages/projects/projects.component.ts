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
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.css',
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
