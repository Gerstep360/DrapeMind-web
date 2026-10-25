import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PlatformComponent } from './platform.component';
import { AuthService } from '@core/auth.service';
import { SaaSService } from '@core/saas.service';

const plan = {
  id: 7,
  name: 'Básico',
  code: 'BASIC',
  active: true,
  max_branches: 2,
  currency: 'bob',
  monthly_amount_minor: 9900,
  annual_amount_minor: 99000,
  features: {
    products_sales: true,
    reservations: true,
    offline: true,
    reports: true,
    ai_reports: false,
  },
};
describe('Company onboarding', () => {
  let api: any;
  beforeEach(() => {
    api = { tenants: vi.fn(() => of([])), plans: vi.fn(() => of([plan])), createTenant: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { logout: vi.fn() } },
        { provide: SaaSService, useValue: api },
      ],
    });
  });
  function setup() {
    const fixture = TestBed.createComponent(PlatformComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');
    component.openCompany();
    fixture.detectChanges();
    return { fixture, component };
  }
  it('explains missing data and never silently disables company submission', () => {
    const { fixture, component } = setup();
    component.companyForm.controls.name.setValue('Urban Fit');
    component.nextStep();
    fixture.detectChanges();
    expect(component.step()).toBe(2);
    component.companyForm.patchValue({
      admin_name: 'Ana',
      admin_email: 'ana@example.com',
      admin_password: 'short',
    });
    component.nextStep();
    fixture.detectChanges();
    expect(component.step()).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Usa al menos 12 caracteres.');
    expect(api.createTenant).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('Price ID');
  });
  it('prepares a company link and submits an active plan without requiring technical identifiers', () => {
    const { fixture, component } = setup();
    component.companyForm.patchValue({
      name: 'Urban Fit',
      admin_name: 'Ana',
      admin_email: 'ANA@example.com',
      admin_password: 'Company-owner-123!',
    });
    expect(component.suggestedSlug()).toBe('urban-fit');
    expect(component.companyForm.controls.plan_id.value).toBe(7);
    api.createTenant.mockReturnValue(
      of({ tenant: { id: 10, name: 'Urban Fit', slug: 'urban-fit' }, access_active: false }),
    );
    component.nextStep();
    component.nextStep();
    component.create();
    fixture.detectChanges();
    expect(api.createTenant).toHaveBeenCalledOnce();
    const payload = api.createTenant.mock.calls[0][0];
    expect(payload.slug).toBeUndefined();
    expect(payload.admin_email).toBe('ana@example.com');
    expect(payload.plan_id).toBe(7);
    expect(component.created()?.tenant.slug).toBe('urban-fit');
    expect(component.companyForm.controls.admin_password.value).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Urban Fit');
  });
  it('shows a readable error and preserves the form for correction', () => {
    const { component } = setup();
    component.companyForm.patchValue({
      name: 'Urban Fit',
      admin_name: 'Ana',
      admin_email: 'ana@example.com',
      admin_password: 'Company-owner-123!',
    });
    api.createTenant.mockReturnValue(
      throwError(() => ({ error: { detail: 'Este enlace ya pertenece a otra tienda.' } })),
    );
    component.create();
    expect(component.error()).toContain('otra tienda');
    expect(component.busy()).toBe(false);
    expect(component.companyForm.controls.name.value).toBe('Urban Fit');
  });
  it('uses the annual amount when changing billing period', () => {
    const { component } = setup();
    component.editPlan(plan as any);
    component.priceForm.controls.interval.setValue('year');
    component.changePriceInterval();
    expect(component.priceForm.controls.amount.value).toBe(990);
    component.editPlan(plan as any);
    expect(component.priceForm.controls.interval.value).toBe('month');
    expect(component.priceForm.controls.amount.value).toBe(99);
  });
  it('allows activating a pending company that has no Stripe subscription', () => {
    const { component, fixture } = setup();
    component.companyDialog!.nativeElement.close();
    const dialog = component.licenseDialog!.nativeElement;
    dialog.showModal = () => dialog.setAttribute('open', '');
    component.editLicense({
      tenant: { id: 10, name: 'Nueva tienda', slug: 'nueva', active: true, is_demo: false },
      subscription: {
        id: 1,
        status: 'PENDING',
        source: 'STRIPE',
        managed_by_stripe: false,
        starts_at: null,
        ends_at: null,
        cancel_at_period_end: false,
      },
      plan: plan as any,
      access_active: false,
      active_branches: 0,
    });
    fixture.detectChanges();
    expect(component.licenseForm.controls.status.value).toBe('ACTIVE');
    const save = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Guardar suscripción'));
    expect(save?.disabled).toBe(false);
  });
});
