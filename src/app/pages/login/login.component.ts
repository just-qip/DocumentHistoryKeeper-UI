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
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
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

  /** @returns true, если все поля для регистрации заполнены */
  canRegister(): boolean {
    return !!this.emailField.trim() && !!this.displayNameField.trim() && !!this.passwordField;
  }

  /** Шаг 1: ищем аккаунт по email. */
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

  /** Возврат на шаг ввода email. */
  backToEmail(): void {
    this.view.set('email');
    this.selected.set(null);
    this.passwordField = '';
    this.error.set(null);
  }

  /** Переключение на форму регистрации. */
  goRegister(): void {
    this.error.set(null);
    this.view.set('register');
  }

  /** Шаг 3: SRP-логин. */
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

  /** Регистрация + автоматический вход. */
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
