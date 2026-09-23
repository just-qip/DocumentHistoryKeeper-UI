import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AccountApiService } from '../../core/api/account-api.service';
import { AccountContextService } from '../../core/account-context.service';
import { Account } from '../../core/models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login">
      <h1>Вход</h1>
      <p class="hint">Выберите аккаунт или создайте новый.</p>

      @if (error()) {
        <div class="error">{{ error() }}</div>
      }

      <label>Tenant ID</label>
      <input [(ngModel)]="tenantId" placeholder="UUID" />

      <div class="actions">
        <button (click)="load()" [disabled]="loading()">
          {{ loading() ? 'Загрузка…' : 'Загрузить аккаунты' }}
        </button>
      </div>

      @if (accounts().length > 0) {
        <ul class="accounts">
          @for (a of accounts(); track a.id) {
            <li (click)="select(a)">
              <div class="name">{{ a.displayName }}</div>
              <div class="email">{{ a.email }}</div>
              <code>{{ a.id }}</code>
            </li>
          }
        </ul>
      }

      <details>
        <summary>Создать аккаунт</summary>
        <div class="create">
          <input [(ngModel)]="newEmail" placeholder="email" />
          <input [(ngModel)]="newName" placeholder="display name" />
          <button (click)="createAccount()">Создать</button>
        </div>
      </details>
    </div>
  `,
  styles: [
    `
      .login {
        max-width: 520px;
        margin: 40px auto;
        background: #fff;
        padding: 32px;
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      }
      h1 {
        margin: 0 0 8px;
      }
      .hint {
        color: #64748b;
        margin: 0 0 24px;
      }
      label {
        display: block;
        margin: 12px 0 4px;
        font-size: 13px;
        color: #334155;
      }
      input {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font: inherit;
        box-sizing: border-box;
      }
      .actions {
        margin-top: 12px;
      }
      button {
        padding: 8px 16px;
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
      .accounts {
        list-style: none;
        padding: 0;
        margin: 24px 0 0;
      }
      .accounts li {
        padding: 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .accounts li:hover {
        background: #f1f5f9;
      }
      .name {
        font-weight: 600;
      }
      .email {
        color: #64748b;
        font-size: 13px;
      }
      code {
        font-size: 11px;
        color: #94a3b8;
      }
      .error {
        padding: 10px 12px;
        border-radius: 6px;
        background: #fee2e2;
        color: #991b1b;
        font-size: 13px;
        margin-bottom: 12px;
      }
      details {
        margin-top: 24px;
        font-size: 13px;
        color: #334155;
      }
      .create {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 12px;
      }
    `,
  ],
})
export class LoginComponent {
  private readonly api = inject(AccountApiService);
  private readonly ctx = inject(AccountContextService);
  private readonly router = inject(Router);

  tenantId = environment.defaultTenantId;
  newEmail = '';
  newName = '';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly accounts = signal<Account[]>([]);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list(this.tenantId).subscribe({
      next: (list) => {
        this.accounts.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Не удалось загрузить аккаунты');
        this.loading.set(false);
      },
    });
  }

  select(a: Account): void {
    this.ctx.setAccount(a); // ← было this.ctx.setAccount(a.id)
    this.router.navigate(['/projects']);
  }

  createAccount(): void {
    if (!this.newEmail || !this.newName) return;
    this.api.create(this.tenantId, this.newEmail, this.newName).subscribe({
      next: (a) => {
        this.newEmail = '';
        this.newName = '';
        this.accounts.update((prev) => [a, ...prev]);
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Ошибка создания'),
    });
  }
}
