import { Injectable, computed, inject, signal } from '@angular/core';
import { Account } from './models';
import { SessionService } from './session.service';

const KEY = 'dhk.currentAccount';

/** Хранит аккаунт и сессию. */
@Injectable({ providedIn: 'root' })
export class AccountContextService {
  private readonly session = inject(SessionService);
  private readonly _account = signal<Account | null>(this.read());

  readonly account = computed(() => this._account());
  readonly accountId = computed(() => this._account()?.id ?? null);
  readonly isAuthenticated = computed(
    () => this._account() !== null && this.session.token() !== null,
  );

  setAccount(account: Account | null, token?: string | null): void {
    if (account) {
      localStorage.setItem(KEY, JSON.stringify(account));
      this._account.set(account);
      if (token !== undefined) this.session.set(token);
    } else {
      localStorage.removeItem(KEY);
      this._account.set(null);
      this.session.clear();
    }
  }

  refresh(account: Account): void {
    localStorage.setItem(KEY, JSON.stringify(account));
    this._account.set(account);
  }

  clear(): void {
    this.setAccount(null, null);
  }

  private read(): Account | null {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.id === 'string') {
        return parsed as Account;
      }
    } catch {
      // повреждённый JSON
    }
    return null;
  }
}
