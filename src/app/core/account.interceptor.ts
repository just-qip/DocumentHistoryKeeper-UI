import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AccountContextService } from './account-context.service';

export const accountInterceptor: HttpInterceptorFn = (req, next) => {
  const ctx = inject(AccountContextService);
  const id = ctx.accountId();

  if (!id || req.headers.has('X-Account-Id')) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-Account-Id': id } }));
};
