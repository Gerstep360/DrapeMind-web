import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, CanActivateFn } from '@angular/router';
import { catchError, map, of, tap } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { AuthService } from './auth.service';

export interface SaaSPlan {
  id: number;
  code: string;
  name: string;
  max_branches: number;
  active: boolean;
  checkout_available: boolean;
  stripe_price_id?: string | null;
  stripe_annual_price_id?: string | null;
  annual_checkout_available: boolean;
  monthly_amount_minor: number;
  annual_amount_minor: number;
  currency: string;
  features: Record<string, boolean>;
}
export interface CompanySubscription {
  tenant: {
    id: number;
    name: string;
    slug: string;
    active: boolean;
    is_demo: boolean;
    address?: string;
    phone?: string;
    contact_email?: string;
  };
  subscription: {
    id: number;
    status: string;
    starts_at: string | null;
    ends_at: string | null;
    source: string;
    managed_by_stripe?: boolean;
    cancel_at_period_end: boolean;
  } | null;
  plan: SaaSPlan | null;
  access_active: boolean;
  active_branches: number;
  portal_available?: boolean;
}
export function saasError(error: any): string {
  const detail = error?.error?.detail;
  if (Array.isArray(detail))
    return detail.map((item) => item.msg || 'Revisa los datos del formulario').join('. ');
  return typeof detail === 'string'
    ? detail
    : detail?.message ||
        'No se pudo completar la operación. Revisa los datos e intenta nuevamente.';
}

@Injectable({ providedIn: 'root' })
export class SaaSService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);
  readonly current = signal<CompanySubscription | null>(null);
  private readonly auth = inject(AuthService);
  private owner: number | null = null;
  constructor() {
    effect(() => {
      const owner = this.auth.user()?.id || null;
      if (this.owner !== owner) {
        this.owner = owner;
        this.current.set(null);
      }
    });
  }
  get url(): string {
    return this.runtime.apiUrl + '/saas';
  }
  load() {
    this.owner = this.auth.user()?.id || null;
    return this.http
      .get<CompanySubscription>(this.url + '/me')
      .pipe(tap((value) => this.current.set(value)));
  }
  plans() {
    return this.http.get<SaaSPlan[]>(this.url + '/plans');
  }
  tenants() {
    return this.http.get<CompanySubscription[]>(this.url + '/tenants');
  }
  price(id: number, interval: 'month' | 'year' = 'month') {
    return this.http.get<{ amount_minor: number; currency: string; interval: string }>(
      `${this.url}/plans/${id}/price?interval=${interval}`,
    );
  }
  createTenant(data: unknown) {
    return this.http.post<CompanySubscription>(this.url + '/tenants', data);
  }
  state(id: number, active: boolean) {
    return this.http.patch<CompanySubscription>(`${this.url}/tenants/${id}`, { active });
  }
  merchantDetails(id: number, data: unknown) {
    return this.http.put<CompanySubscription>(`${this.url}/tenants/${id}/details`, data);
  }
  savePlan(id: number, data: unknown) {
    return this.http.put<SaaSPlan>(`${this.url}/plans/${id}`, data);
  }
  license(id: number, data: unknown) {
    return this.http.put<CompanySubscription>(`${this.url}/tenants/${id}/subscription`, data);
  }
  configurePrice(id: number, data: unknown) {
    return this.http.post<SaaSPlan>(`${this.url}/plans/${id}/stripe-price`, data);
  }
  checkout(id: number, interval: 'month' | 'year' = 'month') {
    return this.http.post<{ url?: string; synchronized?: boolean; message?: string }>(
      this.url + '/checkout',
      {
        plan_id: id,
        billing_interval: interval,
      },
    );
  }
  sync() {
    return this.http
      .post<CompanySubscription>(this.url + '/sync', {})
      .pipe(tap((value) => this.current.set(value)));
  }
  portal() {
    return this.http.post<{ url: string }>(this.url + '/portal', {});
  }
  openStripe(url: string): void {
    const target = new URL(url);
    if (
      target.protocol !== 'https:' ||
      !['checkout.stripe.com', 'billing.stripe.com'].includes(target.hostname)
    )
      throw new Error('Destino Stripe no válido');
    window.location.assign(target.href);
  }
}

export const platformGuard: CanActivateFn = () =>
  inject(AuthService).user()?.is_platform_admin
    ? true
    : inject(Router).createUrlTree(['/dashboard']);
export const aiReportsPlanGuard: CanActivateFn = () => {
  const service = inject(SaaSService),
    router = inject(Router);
  return service.load().pipe(
    map((value) =>
      value.access_active && value.plan?.features['ai_reports']
        ? true
        : router.createUrlTree(['/subscription']),
    ),
    catchError(() => of(router.createUrlTree(['/subscription']))),
  );
};
