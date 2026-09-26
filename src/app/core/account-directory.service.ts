import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AccountApiService } from './api/account-api.service';
import { Account } from './models';

/**
 * Справочник аккаунтов. Один на всё приложение, ключ — id аккаунта.
 */
@Injectable({ providedIn: 'root' })
export class AccountDirectoryService {
  private readonly api = inject(AccountApiService);

  private readonly _byId = signal<Map<string, Account>>(new Map());
  private loaded = false;
  private loadingPromise: Promise<void> | null = null;

  readonly byId = computed(() => this._byId());

  /**
   * @param id идентификатор аккаунта
   * @returns displayName или null
   */
  displayName(id: string | null | undefined): string | null {
    if (!id) return null;
    return this._byId().get(id)?.displayName ?? null;
  }

  /**
   * @param id идентификатор аккаунта
   * @returns email или null
   */
  email(id: string | null | undefined): string | null {
    if (!id) return null;
    return this._byId().get(id)?.email ?? null;
  }

  /** Ленивая загрузка справочника. */
  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = this.load();
    try {
      await this.loadingPromise;
    } finally {
      this.loadingPromise = null;
    }
  }

  /** Полный сброс кэша. Вызывать при смене аккаунта. */
  reset(): void {
    this._byId.set(new Map());
    this.loaded = false;
    this.loadingPromise = null;
  }

  private async load(): Promise<void> {
    try {
      const list = await firstValueFrom(this.api.list());
      const map = new Map<string, Account>();
      for (const a of list) map.set(a.id, a);
      this._byId.set(map);
      this.loaded = true;
    } catch {
      // Если не удалось загрузить — оставляем как есть, UI покажет fallback.
    }
  }
}
