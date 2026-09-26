import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccountContextService } from './account-context.service';

export const adminGuard: CanActivateFn = () => {
  const ctx = inject(AccountContextService);
  const router = inject(Router);
  const a = ctx.account();
  if (a && a.systemRole === 'ADMIN') return true;
  return router.createUrlTree(['/projects']);
};
