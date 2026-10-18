import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from './auth.service';
import { RuntimeConfigService } from './runtime-config.service';
import { TenantService } from './tenant.service';
import { authInterceptor } from './auth.interceptor';
import { SaaSService } from './saas.service';

const token = (sub: number, tid: number) =>
  'header.' + btoa(JSON.stringify({ sub: String(sub), tid })) + '.signature';

describe('SaaS request boundaries', () => {
  const auth = {
    token: signal<string | null>(null),
    user: signal<any>(null),
    hasValidToken: () => true,
    logout: vi.fn(),
  };
  const tenant = { slug: signal('company-a') };
  const router = { url: '/catalog', navigate: vi.fn() };
  let http: HttpClient, requests: HttpTestingController;
  beforeEach(() => {
    auth.token.set(token(1, 1));
    auth.user.set({ id: 1, tenant_id: 1 });
    tenant.slug.set('company-a');
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: TenantService, useValue: tenant },
        { provide: RuntimeConfigService, useValue: { apiUrl: '/api/v1' } },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
  });
  afterEach(() => requests.verify());
  it('sends selected company and signed session only to the application API', () => {
    http.get('/api/v1/catalog/products').subscribe();
    const own = requests.expectOne('/api/v1/catalog/products');
    expect(own.request.headers.get('X-Tenant')).toBe('company-a');
    expect(own.request.headers.get('Authorization')).toBe('Bearer ' + auth.token());
    own.flush([]);
    http.get('https://example.com/photo').subscribe();
    const external = requests.expectOne('https://example.com/photo');
    expect(external.request.headers.has('Authorization')).toBe(false);
    expect(external.request.headers.has('X-Tenant')).toBe(false);
    external.flush({});
  });
  it('discards responses from a company after switching accounts', () => {
    const received = vi.fn();
    http.get('/api/v1/cart').subscribe(received);
    const pending = requests.expectOne('/api/v1/cart');
    auth.token.set(token(2, 2));
    tenant.slug.set('company-b');
    pending.flush({ items: ['old company'] });
    expect(received).not.toHaveBeenCalled();
  });
  it('keeps responses across token renewal for the same account', () => {
    const received = vi.fn();
    http.get('/api/v1/cart').subscribe(received);
    const pending = requests.expectOne('/api/v1/cart');
    auth.token.set(token(1, 1) + '.renewed');
    pending.flush({ items: [] });
    expect(received).toHaveBeenCalled();
  });
  it('opens billing recovery on an expired company without logging out', () => {
    http.get('/api/v1/catalog/products').subscribe({ error: () => {} });
    requests
      .expectOne('/api/v1/catalog/products')
      .flush(
        { detail: { code: 'SUBSCRIPTION_REQUIRED' } },
        { status: 402, statusText: 'Payment Required' },
      );
    expect(router.navigate).toHaveBeenCalledWith(['/subscription']);
    expect(auth.logout).not.toHaveBeenCalled();
  });
  it('does not redirect another account because an old request expired', () => {
    http.get('/api/v1/catalog/products').subscribe({ error: () => {} });
    const pending = requests.expectOne('/api/v1/catalog/products');
    auth.token.set(token(2, 2));
    tenant.slug.set('company-b');
    pending.flush({}, { status: 402, statusText: 'Payment Required' });
    expect(router.navigate).not.toHaveBeenCalled();
  });
  it('sends the billing interval and rejects an external payment destination', () => {
    const service = TestBed.inject(SaaSService);
    service.checkout(2, 'year').subscribe();
    const pending = requests.expectOne('/api/v1/saas/checkout');
    expect(pending.request.body).toEqual({ plan_id: 2, billing_interval: 'year' });
    pending.flush({ url: 'https://checkout.stripe.com/test' });
    expect(() => service.openStripe('https://checkout.stripe.com.evil.example/pay')).toThrow();
  });
});
