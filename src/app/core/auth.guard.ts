import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccountContextService } from './account-context.service';

export const authGuard: CanActivateFn = () => {
  const ctx = inject(AccountContextService);
  const router = inject(Router);
  if (ctx.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};
