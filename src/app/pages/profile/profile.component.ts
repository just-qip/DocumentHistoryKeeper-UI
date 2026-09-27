import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../../core/api/auth-api.service';
import { ProfileApiService } from '../../core/api/profile-api.service';
import { AccountContextService } from '../../core/account-context.service';
import { AccountDirectoryService } from '../../core/account-directory.service';
import { SrpService } from '../../core/srp.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  readonly avatarInput = viewChild<ElementRef<HTMLInputElement>>('avatarInput');

  private readonly profile = inject(ProfileApiService);
  private readonly auth = inject(AuthApiService);
  private readonly ctx = inject(AccountContextService);
  private readonly directory = inject(AccountDirectoryService);
  private readonly srp = inject(SrpService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Профиль с сервера. */
  readonly account = signal(this.ctx.account());

  /** Blob-URL для аватара. */
  readonly avatarUrl = signal<string | null>(null);

  /** Флаги состояния. */
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly changingPassword = signal(false);

  /** Форма информации. */
  displayName = '';

  /** Форма аватара — предпросмотр до загрузки. */
  avatarPreview: string | null = null;
  avatarFile: File | null = null;

  /** Форма пароля. */
  oldPassword = '';
  newPassword = '';
  newPassword2 = '';

  constructor() {
    this.destroyRef.onDestroy(() => this.revokeAvatarUrl());

    // Fire-and-forget: оба запроса идут параллельно.
    void this.loadProfile();
    void this.loadAvatar();

    // Стартуем с кэшированного имени, чтобы инпут был заполнен мгновенно.
    this.displayName = this.ctx.account()?.displayName ?? '';
  }

  /* ---------- Загрузка ---------- */

  private async loadProfile(): Promise<void> {
    try {
      const fresh = await firstValueFrom(this.profile.me());
      this.account.set(fresh);
      this.displayName = fresh.displayName;
      this.ctx.refresh(fresh);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? e?.message ?? 'Не удалось загрузить профиль');
    }
  }

  /**
   * Тянет blob аватара. Если сервер вернёт 404 — тихо оставляем fallback.
   * Запускается сразу, не дожидаясь {@link loadProfile}.
   */
  private async loadAvatar(): Promise<void> {
    try {
      const blob = await firstValueFrom(this.profile.avatarBlob());
      // Между запуском и ответом могли успеть поменять аватар —
      // не перетираем актуальный blob.
      if (this.avatarPreview) return;
      this.revokeAvatarUrl();
      this.avatarUrl.set(URL.createObjectURL(blob));
    } catch {
      // 404 — аватара нет, покажем fallback с инициалом.
    }
  }

  /* ---------- Аватар ---------- */

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      this.error.set('Файл больше 2 МБ');
      input.value = '';
      return;
    }
    const mime = file.type.toLowerCase();
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mime)) {
      this.error.set('Поддерживаются PNG, JPEG, WebP или GIF');
      input.value = '';
      return;
    }

    this.error.set(null);
    this.avatarFile = file;

    const reader = new FileReader();
    reader.onload = () => (this.avatarPreview = reader.result as string);
    reader.readAsDataURL(file);
  }

  async uploadAvatar(): Promise<void> {
    if (!this.avatarFile) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const fresh = await firstValueFrom(this.profile.uploadAvatar(this.avatarFile));
      this.account.set(fresh);
      this.ctx.refresh(fresh);
      this.directory.reset();
      this.clearAvatarPicker();
      await this.reloadAvatarFromServer();
      this.flash('Аватар обновлён');
    } catch (e: any) {
      this.error.set(e?.error?.message ?? e?.message ?? 'Не удалось загрузить аватар');
    } finally {
      this.saving.set(false);
    }
  }

  async removeAvatar(): Promise<void> {
    if (!confirm('Удалить аватар?')) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const fresh = await firstValueFrom(this.profile.deleteAvatar());
      this.account.set(fresh);
      this.ctx.refresh(fresh);
      this.revokeAvatarUrl();
      this.flash('Аватар удалён');
    } catch (e: any) {
      this.error.set(e?.error?.message ?? e?.message ?? 'Не удалось удалить аватар');
    } finally {
      this.saving.set(false);
    }
  }

  cancelAvatarSelection(): void {
    this.clearAvatarPicker();
  }

  private clearAvatarPicker(): void {
    this.avatarFile = null;
    this.avatarPreview = null;
    const input = this.avatarInput()?.nativeElement;
    if (input) input.value = '';
  }

  /** Перечитывает blob с сервера после upload — иначе браузер отдаст старый из HTTP-кэша. */
  private async reloadAvatarFromServer(): Promise<void> {
    this.revokeAvatarUrl();
    try {
      const blob = await firstValueFrom(this.profile.avatarBlob());
      this.avatarUrl.set(URL.createObjectURL(blob));
    } catch {
      // ignore
    }
  }

  private revokeAvatarUrl(): void {
    const url = this.avatarUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.avatarUrl.set(null);
    }
  }

  /* ---------- Инфо ---------- */

  async saveInfo(): Promise<void> {
    const name = this.displayName.trim();
    if (!name) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const fresh = await firstValueFrom(this.profile.update(name));
      this.account.set(fresh);
      this.ctx.refresh(fresh);
      this.directory.reset();
      this.flash('Сохранено');
    } catch (e: any) {
      this.error.set(e?.error?.message ?? e?.message ?? 'Не удалось сохранить');
    } finally {
      this.saving.set(false);
    }
  }

  /* ---------- Пароль ---------- */

  canChangePassword(): boolean {
    return (
      this.oldPassword.length > 0 &&
      this.newPassword.length >= 8 &&
      this.newPassword === this.newPassword2
    );
  }

  async changePassword(): Promise<void> {
    if (!this.canChangePassword()) return;
    const email = this.account()?.email;
    if (!email) return;

    this.changingPassword.set(true);
    this.error.set(null);
    try {
      const ch = await firstValueFrom(this.auth.challenge(email));
      const proof = await this.srp.challenge(email, this.oldPassword, ch.saltHex, ch.BHex);
      const { saltHex, verifierHex } = await this.srp.register(email, this.newPassword);

      await firstValueFrom(
        this.profile.changePassword({
          challengeId: ch.challengeId,
          aHex: proof.AHex,
          m1Hex: proof.M1Hex,
          newSaltHex: saltHex,
          newVerifierHex: verifierHex,
        }),
      );

      this.directory.reset();
      this.ctx.clear();
      await this.router.navigate(['/login']);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? e?.message ?? 'Не удалось сменить пароль');
    } finally {
      this.changingPassword.set(false);
    }
  }

  /* ---------- Хелперы ---------- */

  initial(): string {
    const n = this.account()?.displayName?.trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  }

  private flash(msg: string): void {
    this.success.set(msg);
    setTimeout(() => this.success.set(null), 2500);
  }
}
