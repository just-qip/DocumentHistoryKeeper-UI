import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AccountContextService } from './core/account-context.service';
import { AccountApiService } from './core/api/account-api.service';
import pkg from '../../package.json';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly ctx = inject(AccountContextService);
  private readonly accounts = inject(AccountApiService);
  private readonly router = inject(Router);

  readonly account = this.ctx.account;
  readonly version = pkg.version;

  ngOnInit(): void {
    const current = this.ctx.account();
    if (current && !current.displayName) {
      this.accounts.get(current.id).subscribe({
        next: (fresh) => this.ctx.refresh(fresh),
        error: () => this.ctx.clear(),
      });
    }
  }

  logout(): void {
    this.ctx.clear();
    this.router.navigate(['/login']);
  }
}
