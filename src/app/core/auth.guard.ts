import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.hasValidToken()) {
    return router.createUrlTree(['/login']);
  }
  if (auth.user()) {
    return auth.user()?.is_platform_admin && !state.url.startsWith('/saas-platform')
      ? router.createUrlTree(['/saas-platform'])
      : true;
  }
  return auth.loadMe().pipe(
    map((user) =>
      user.is_platform_admin && !state.url.startsWith('/saas-platform')
        ? router.createUrlTree(['/saas-platform'])
        : true,
    ),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};
