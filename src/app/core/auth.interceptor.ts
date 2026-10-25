import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, catchError, filter, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';
import { RuntimeConfigService } from './runtime-config.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService),
    tenant = inject(TenantService),
    router = inject(Router);
  const base = inject(RuntimeConfigService).apiUrl;
  if (!(request.url === base || request.url.startsWith(base + '/'))) return next(request);
  // El acceso descubre la cuenta por credenciales, sin arrastrar la tienda o JWT anteriores.
  if (request.url === base + '/auth/login') return next(request);
  const company = tenant.slug();
  const token = auth.hasValidToken() ? auth.token() : null;
  const owner = () => {
    try {
      return JSON.stringify(
        (({ sub, tid, platform }) => ({ sub, tid, platform }))(
          JSON.parse(
            atob((auth.token()?.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/')),
          ),
        ),
      );
    } catch {
      return null;
    }
  };
  const identity = owner();
  const authorized = request.clone({
    setHeaders: { ...(company ? { 'X-Tenant': company } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  return next(authorized).pipe(
    filter(
      (event) =>
        !(event instanceof HttpResponse) || (owner() === identity && tenant.slug() === company),
    ),
    catchError((error: HttpErrorResponse) => {
      if (owner() !== identity || tenant.slug() !== company) return EMPTY;
      if (error.status === 401 && token && auth.token() === token) auth.logout();
      if (error.status === 402 && token && !router.url.startsWith('/subscription'))
        void router.navigate(['/subscription']);
      return throwError(() => error);
    }),
  );
};
