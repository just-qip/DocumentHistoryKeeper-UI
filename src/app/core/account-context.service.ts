import { Injectable, computed, signal } from '@angular/core';
import { Account } from './models';

const STORAGE_KEY = 'dhk.currentAccount';

@Injectable({ providedIn: 'root' })
export class AccountContextService {
  private readonly _account = signal<Account | null>(this.read());

  readonly account = computed(() => this._account());
  readonly accountId = computed(() => this._account()?.id ?? null);
  readonly isAuthenticated = computed(() => this._account() !== null);

  setAccount(account: Account | null): void {
    if (account) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
      this._account.set(account);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      this._account.set(null);
    }
  }

  refresh(account: Account): void {
    this.setAccount(account);
  }

  clear(): void {
    this.setAccount(null);
  }

  private read(): Account | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.id === 'string') {
        return parsed as Account;
      }
    } catch {
      // повреждённый JSON — считаем, что не залогинен
    }
    return null;
  }
}
