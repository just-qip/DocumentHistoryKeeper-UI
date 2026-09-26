import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AccountChoice, AuthApiService } from '../../core/api/auth-api.service';
import { AccountContextService } from '../../core/account-context.service';
import { AccountDirectoryService } from '../../core/account-directory.service';
import { SrpService } from '../../core/srp.service';

/** Экран, который показывается пользователю. */
type View = 'email' | 'password' | 'empty' | 'register';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login">
      <h1>
        @switch (view()) {
          @case ('email') {
            Вход
          }
          @case ('password') {
            Пароль
          }
          @case ('empty') {
            Аккаунт не найден
          }
          @case ('register') {
            Регистрация
          }
        }
      </h1>

      @if (error()) {
        <div class="error">{{ error() }}</div>
      }

      @switch (view()) {
        @case ('email') {
          <p class="hint">Введите email — мы найдём ваш аккаунт.</p>
          <label>Email</label>
          <input
            [(ngModel)]="emailField"
            autocomplete="username"
            (keydown.enter)="continueWithEmail()"
          />
          <div class="actions">
            <button (click)="continueWithEmail()" [disabled]="busy() || !emailField.trim()">
              {{ busy() ? '…' : 'Продолжить' }}
            </button>
            <button class="ghost" type="button" (click)="goRegister()">Регистрация</button>
          </div>
        }

        @case ('password') {
          @if (selected(); as s) {
            <div class="picked">
              <div class="picked-name">{{ s.displayName }}</div>
              <code>{{ submittedEmail() }}</code>
            </div>
          }
          <label>Пароль</label>
          <input
            type="password"
            [(ngModel)]="passwordField"
            autocomplete="current-password"
            (keydown.enter)="submitLogin()"
          />
          <div class="actions">
            <button (click)="submitLogin()" [disabled]="busy() || !passwordField">
              {{ busy() ? '…' : 'Войти' }}
            </button>
            <button class="ghost" type="button" (click)="backToEmail()">Назад</button>
          </div>
        }

        @case ('empty') {
          <p class="hint">
            Аккаунт с email <code>{{ submittedEmail() }}</code> не найден.
          </p>
          <div class="actions">
            <button (click)="goRegister()">Зарегистрироваться</button>
            <button class="ghost" type="button" (click)="backToEmail()">Назад</button>
          </div>
        }

        @case ('register') {
          <p class="hint">Создание аккаунта. Пароль не покидает браузер.</p>
          <label>Email</label>
          <input [(ngModel)]="emailField" autocomplete="username" />
          <label>Отображаемое имя</label>
          <input [(ngModel)]="displayNameField" />
          <label>Пароль</label>
          <input type="password" [(ngModel)]="passwordField" autocomplete="new-password" />
          <div class="actions">
            <button (click)="submitRegister()" [disabled]="busy() || !canRegister()">
              {{ busy() ? '…' : 'Создать' }}
            </button>
            <button class="ghost" type="button" (click)="backToEmail()">Назад</button>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .login {
        max-width: 480px;
        margin: 40px auto;
        background: #fff;
        padding: 32px;
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 22px;
      }
      .hint {
        color: #64748b;
        margin: 0 0 16px;
        font-size: 13px;
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
      input:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
      }
      .actions {
        display: flex;
        gap: 8px;
        margin-top: 20px;
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
      button.ghost {
        background: #f1f5f9;
        color: #1d4ed8;
      }
      .error {
        padding: 10px 12px;
        border-radius: 6px;
        background: #fee2e2;
        color: #991b1b;
        font-size: 13px;
        margin-bottom: 12px;
      }
      code {
        font-size: 11px;
        color: #64748b;
        font-family: ui-monospace, SFMono-Regular, monospace;
      }
      .picked {
        padding: 12px;
        background: #f8fafc;
        border-radius: 8px;
        margin-bottom: 12px;
      }
      .picked-name {
        font-weight: 600;
        margin-bottom: 2px;
      }
    `,
  ],
})
export class LoginComponent {
  private readonly auth = inject(AuthApiService);
  private readonly srp = inject(SrpService);
  private readonly ctx = inject(AccountContextService);
  private readonly directory = inject(AccountDirectoryService);
  private readonly router = inject(Router);

  readonly view = signal<View>('email');
  readonly selected = signal<AccountChoice | null>(null);
  readonly submittedEmail = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  emailField = '';
  passwordField = '';
  displayNameField = '';

  canRegister(): boolean {
    return !!this.emailField.trim() && !!this.displayNameField.trim() && !!this.passwordField;
  }

  async continueWithEmail(): Promise<void> {
    const email = this.emailField.trim();
    if (!email) return;

    this.error.set(null);
    this.busy.set(true);
    try {
      const choice = await firstValueFrom(this.auth.lookup(email));
      this.submittedEmail.set(email);

      if (!choice) {
        this.view.set('empty');
      } else {
        this.selected.set(choice);
        this.view.set('password');
      }
    } catch (e: any) {
      this.error.set(e?.error?.message ?? e?.message ?? 'Ошибка поиска аккаунта');
    } finally {
      this.busy.set(false);
    }
  }

  backToEmail(): void {
    this.view.set('email');
    this.selected.set(null);
    this.passwordField = '';
    this.error.set(null);
  }

  goRegister(): void {
    this.error.set(null);
    this.view.set('register');
  }

  async submitLogin(): Promise<void> {
    const email = this.submittedEmail();
    const password = this.passwordField;
    if (!email || !password) return;

    this.error.set(null);
    this.busy.set(true);
    try {
      await this.doLogin(email, password);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? e?.message ?? 'Неверный пароль');
    } finally {
      this.busy.set(false);
    }
  }

  async submitRegister(): Promise<void> {
    const email = this.emailField.trim();
    const displayName = this.displayNameField.trim() || email;
    const password = this.passwordField;
    if (!email || !password) return;

    this.error.set(null);
    this.busy.set(true);
    try {
      const { saltHex, verifierHex } = await this.srp.register(email, password);
      await firstValueFrom(this.auth.register({ email, displayName, saltHex, verifierHex }));
      await this.doLogin(email, password);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? e?.message ?? 'Ошибка регистрации');
    } finally {
      this.busy.set(false);
    }
  }

  private async doLogin(email: string, password: string): Promise<void> {
    const ch = await firstValueFrom(this.auth.challenge(email));
    const proof = await this.srp.challenge(email, password, ch.saltHex, ch.BHex);
    const resp = await firstValueFrom(this.auth.verify(ch.challengeId, proof.AHex, proof.M1Hex));
    const ok = await this.srp.verifyServer(proof.AHex, proof.M1Hex, proof.K, resp.M2Hex);
    if (!ok) throw new Error('server proof mismatch');

    this.directory.reset();
    this.ctx.setAccount(resp.account, resp.token);
    await this.router.navigate(['/projects']);
  }
}
