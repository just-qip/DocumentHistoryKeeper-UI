import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AccountApiService } from './api/account-api.service';
import { AccountContextService } from './account-context.service';
import { Account } from './models';

/**
 * Справочник аккаунтов текущего тенанта.
 *
 * Бэкенд в DTO возвращает только UUID актора, поэтому на клиенте
 * храним map id → Account и резолвим имена/тенант для отображения.
 */
@Injectable({ providedIn: 'root' })
export class AccountDirectoryService {
  private readonly api = inject(AccountApiService);
  private readonly ctx = inject(AccountContextService);

  private readonly _byId = signal<Map<string, Account>>(new Map());
  private loadedForTenant: string | null = null;
  private loadingPromise: Promise<void> | null = null;

  /** Карта id → Account (только для чтения). */
  readonly byId = computed(() => this._byId());

  /**
   * Возвращает displayName по id актора, или null, если не найден.
   *
   * @param id идентификатор аккаунта
   */
  displayName(id: string | null | undefined): string | null {
    if (!id) return null;
    return this._byId().get(id)?.displayName ?? null;
  }

  /**
   * Возвращает email по id актора, или null.
   *
   * @param id идентификатор аккаунта
   */
  email(id: string | null | undefined): string | null {
    if (!id) return null;
    return this._byId().get(id)?.email ?? null;
  }

  /**
   * Возвращает tenant_id по id актора, или null.
   *
   * @param id идентификатор аккаунта
   */
  tenantId(id: string | null | undefined): string | null {
    if (!id) return null;
    return this._byId().get(id)?.tenantId ?? null;
  }

  /**
   * Ленивая загрузка справочника. Один раз на тенант.
   */
  async ensureLoaded(): Promise<void> {
    const current = this.ctx.account();
    const tenantId = current?.tenantId;

    if (!tenantId) return;
    if (this.loadedForTenant === tenantId) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = this.load(tenantId);
    try {
      await this.loadingPromise;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async load(tenantId: string): Promise<void> {
    try {
      const list = await firstValueFrom(this.api.list(tenantId));
      const map = new Map<string, Account>();
      for (const a of list) map.set(a.id, a);
      this._byId.set(map);
      this.loadedForTenant = tenantId;
    } catch {
      // Если не удалось загрузить — оставляем как есть, UI покажет fallback.
    }
  }

  /**
   * Полный сброс кэша. Вызывать при смене аккаунта.
   */
  reset(): void {
    this._byId.set(new Map());
    this.loadedForTenant = null;
    this.loadingPromise = null;
  }
}
