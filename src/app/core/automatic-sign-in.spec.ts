import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';
import { RuntimeConfigService } from './runtime-config.service';
import { authInterceptor } from './auth.interceptor';
import { BranchService } from './branch.service';
import { LoginComponent } from '../packages/acceso-gestion-usuarios/iniciar-sesion/login.component';

const jwt = (platform = false) =>
  'header.' +
  btoa(
    JSON.stringify({
      sub: '42',
      tid: platform ? null : 2,
      platform,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ) +
  '.signature';
const profile = (platform = false) => ({
  id: 42,
  nombre: 'Cuenta de prueba',
  email: 'account@example.com',
  rol: platform ? 'ADMIN' : 'CLIENTE',
  estado: 'ACTIVO',
  created_at: '2026-01-01T00:00:00Z',
  telefono: null,
  tenant_id: platform ? null : 2,
  is_platform_admin: platform,
  tenant_slug: platform ? null : 'store-b',
  tenant_name: platform ? null : 'Tienda B',
  has_style_profile: true,
});

describe('Automatic account sign-in', () => {
  let requests: HttpTestingController, auth: AuthService, tenant: TenantService;
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: RuntimeConfigService, useValue: { apiUrl: '/api/v1' } },
        { provide: BranchService, useValue: { loadBranches: vi.fn() } },
      ],
    });
    requests = TestBed.inject(HttpTestingController);
    tenant = TestBed.inject(TenantService);
    auth = TestBed.inject(AuthService);
  });
  afterEach(() => {
    requests.verify();
    auth.logout(false);
    localStorage.clear();
    sessionStorage.clear();
  });
  it('identifies the store in one request without a role or stale company header', () => {
    tenant.select('old-store');
    const received = vi.fn();
    auth.login('account@example.com', 'password').subscribe(received);
    const request = requests.expectOne('/api/v1/auth/login');
    expect(request.request.body).toEqual({ email: 'account@example.com', password: 'password' });
    expect(request.request.headers.has('X-Tenant')).toBe(false);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({
      access_token: jwt(),
      expires_in: 3600,
      token_type: 'bearer',
      user: profile(),
      tenant: { id: 2, slug: 'store-b', name: 'Tienda B' },
      redirect_path: '/catalog',
    });
    expect(received).toHaveBeenCalledOnce();
    expect(tenant.slug()).toBe('store-b');
    expect(auth.destination()).toBe('/catalog');
    requests.expectNone('/api/v1/auth/me');
  });
  it('uses the store URL only to resolve the account and clears it after login', () => {
    tenant.enterStore('store-b');
    auth.login('account@example.com', 'password').subscribe();
    const request = requests.expectOne('/api/v1/auth/login');
    expect(request.request.body.tenant_slug).toBe('store-b');
    request.flush({
      access_token: jwt(),
      expires_in: 3600,
      user: profile(),
      tenant: { id: 2, slug: 'store-b', name: 'Tienda B' },
      redirect_path: '/catalog',
    });
    expect(tenant.entrySlug()).toBeNull();
  });
  it('recognizes platform administration from the verified response', () => {
    auth.login('account@example.com', 'password').subscribe();
    requests
      .expectOne('/api/v1/auth/login')
      .flush({
        access_token: jwt(true),
        expires_in: 3600,
        user: profile(true),
        tenant: null,
        redirect_path: '/saas-platform',
      });
    expect(auth.user()?.is_platform_admin).toBe(true);
    expect(tenant.slug()).toBe('');
    expect(auth.destination()).toBe('/saas-platform');
  });
  it('enters another store with the current customer session without asking for credentials again', () => {
    auth.login('account@example.com', 'password').subscribe();
    requests
      .expectOne('/api/v1/auth/login')
      .flush({
        access_token: jwt(),
        expires_in: 3600,
        user: { ...profile(), is_universal_customer: true },
        tenant: { id: 2, slug: 'store-b', name: 'Tienda B' },
        redirect_path: '/catalog',
      });
    auth.enterStore('store-c').subscribe();
    const request = requests.expectOne('/api/v1/auth/store');
    expect(request.request.body).toEqual({ slug: 'store-c' });
    expect(request.request.headers.get('Authorization')).toContain('Bearer ');
    request.flush({
      access_token: jwt(),
      expires_in: 3600,
      user: {
        ...profile(),
        id: 99,
        tenant_id: 3,
        tenant_slug: 'store-c',
        tenant_name: 'Tienda C',
        is_universal_customer: true,
      },
      tenant: { id: 3, slug: 'store-c', name: 'Tienda C' },
      redirect_path: '/catalog',
    });
    expect(tenant.slug()).toBe('store-c');
    expect(auth.user()?.id).toBe(99);
    requests.expectNone('/api/v1/auth/me');
  });
  it('shows only email and password, without company or administration controls', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const node = fixture.nativeElement as HTMLElement;
    expect(node.querySelector('input[type="checkbox"]')).toBeNull();
    expect(node.querySelector('[formControlName="company"]')).toBeNull();
    expect(node.querySelector('#email')).not.toBeNull();
    expect(node.querySelector('#password')).not.toBeNull();
  });
  it('shows a useful message if an authenticated email needs its store link', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.form.patchValue({
      email: 'account@example.com',
      password: 'Password123!',
    });
    fixture.componentInstance.submit();
    requests
      .expectOne('/api/v1/auth/login')
      .flush(
        { detail: { code: 'STORE_LINK_REQUIRED', message: 'Abre el enlace de tu tienda.' } },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Abre el enlace de tu tienda.');
    expect(auth.isAuthenticated()).toBe(false);
  });
});
