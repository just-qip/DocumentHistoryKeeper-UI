import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AccountContextService } from './core/account-context.service';
import { AuthApiService } from './core/api/auth-api.service';
import pkg from '../../package.json';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly ctx = inject(AccountContextService);
  private readonly auth = inject(AuthApiService);
  private readonly router = inject(Router);

  readonly account = this.ctx.account;
  readonly isAdmin = computed(() => this.ctx.account()?.systemRole === 'ADMIN');
  readonly version = pkg.version;

  /** Открыт ли off-canvas сайдбар (мобильный режим). */
  readonly menuOpen = signal(false);

  async ngOnInit(): Promise<void> {
    if (!this.ctx.isAuthenticated()) return;
    try {
      const fresh = await firstValueFrom(this.auth.me());
      this.ctx.refresh(fresh);
    } catch {
      this.ctx.clear();
    }
  }

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.auth.logout());
    } catch {
      // не важно
    }
    this.closeMenu();
    this.ctx.clear();
    await this.router.navigate(['/login']);
  }
}
