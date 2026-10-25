import {
  Component,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { forkJoin, finalize } from 'rxjs';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/auth.service';
import { SaaSService, SaaSPlan, CompanySubscription, saasError } from '@core/saas.service';

@Component({
  selector: 'app-saas-platform',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './platform.component.scss',
  templateUrl: './platform.component.html',
})
export class PlatformComponent implements OnInit {
  @ViewChild('detailsDialog') detailsDialog?: ElementRef<HTMLDialogElement>;
  readonly editingCompany = signal<CompanySubscription | null>(null);
  readonly auth = inject(AuthService);
  private readonly service = inject(SaaSService);
  private readonly fb = inject(FormBuilder);
  @ViewChild('companyDialog') companyDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('licenseDialog') licenseDialog?: ElementRef<HTMLDialogElement>;
  readonly tab = signal<'companies' | 'plans'>('companies');
  readonly loading = signal(false);
  readonly search = signal('');
  readonly step = signal(1);
  readonly showPassword = signal(false);
  readonly created = signal<CompanySubscription | null>(null);
  readonly filtered = computed(() =>
    this.tenants().filter((row) =>
      row.tenant.name.toLowerCase().includes(this.search().toLowerCase()),
    ),
  );
  readonly tenants = signal<CompanySubscription[]>([]);
  readonly plans = signal<SaaSPlan[]>([]);
  readonly error = signal('');
  readonly notice = signal('');
  readonly busy = signal(false);
  readonly editingPlan = signal<SaaSPlan | null>(null);
  readonly editingTenant = signal<CompanySubscription | null>(null);
  readonly featureLabels = [
    { key: 'products_sales', label: 'Productos y ventas' },
    { key: 'reservations', label: 'Reservas' },
    { key: 'offline', label: 'Cat?logo sin conexi?n' },
    { key: 'reports', label: 'Reportes normales' },
    { key: 'ai_reports', label: 'Reportes con IA' },
  ];
  readonly companyForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    slug: ['', [Validators.maxLength(80), Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    admin_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    admin_email: ['', [Validators.required, Validators.email]],
    admin_password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(72)]],
    plan_id: [1, Validators.required],
    address: [''],
    phone: [''],
    contact_email: ['', Validators.email],
    activation: ['CHECKOUT'],
    ends_at: [this.futureDate()],
  });
  readonly detailsForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    address: [''],
    phone: [''],
    contact_email: ['', Validators.email],
  });
  editCompany(row: CompanySubscription) {
    this.editingCompany.set(row);
    this.detailsForm.reset({
      name: row.tenant.name,
      address: row.tenant.address || '',
      phone: row.tenant.phone || '',
      contact_email: row.tenant.contact_email || '',
    });
    this.error.set('');
    this.detailsDialog?.nativeElement.showModal();
  }
  saveCompany() {
    const row = this.editingCompany();
    if (!row || this.detailsForm.invalid || this.busy()) return;
    this.begin();
    const values = this.detailsForm.getRawValue();
    this.service
      .merchantDetails(row.tenant.id, { ...values, contact_email: values.contact_email || null })
      .subscribe({
        next: () => {
          this.detailsDialog?.nativeElement.close();
          this.done('Datos comerciales guardados.');
        },
        error: (e) => this.fail(e),
      });
  }
  readonly planForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    max_branches: [2, [Validators.required, Validators.min(1)]],
    stripe_price_id: [''],
    active: [true],
    products_sales: [true],
    reservations: [true],
    offline: [true],
    reports: [true],
    ai_reports: [false],
  });
  readonly priceForm = this.fb.nonNullable.group({
    interval: ['month'],
    amount: [99, [Validators.required, Validators.min(1)]],
    currency: ['bob'],
  });
  readonly licenseForm = this.fb.nonNullable.group({
    plan_id: [1, Validators.required],
    status: ['ACTIVE', Validators.required],
    starts_at: ['', Validators.required],
    ends_at: ['', Validators.required],
  });
  ngOnInit() {
    this.load();
  }
  activeCount() {
    return this.tenants().filter((t) => t.access_active).length;
  }
  load() {
    this.loading.set(true);
    forkJoin({ rows: this.service.tenants(), plans: this.service.plans() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ rows, plans }) => {
          this.tenants.set(rows);
          this.plans.set(plans);
        },
        error: (e) => this.fail(e),
      });
  }
  futureDate() {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().slice(0, 10);
  }
  storeLink(slug: string) {
    return new URL('tienda/' + slug, document.baseURI).href;
  }
  suggestedSlug() {
    return (
      this.companyForm.controls.name.value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 65) || 'tu-tienda'
    );
  }
  planPrice(plan: SaaSPlan, annual = false) {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: plan.currency.toUpperCase(),
    }).format((annual ? plan.annual_amount_minor : plan.monthly_amount_minor) / 100);
  }
  status(row: CompanySubscription) {
    return row.access_active
      ? 'Activa'
      : !row.tenant.active
        ? 'Acceso suspendido'
        : {
            PENDING: 'Pendiente de activar',
            EXPIRED: 'Vencida',
            PAST_DUE: 'Pago pendiente',
            SUSPENDED: 'Suspendida',
            CANCELED: 'Cancelada',
          }[row.subscription?.status || ''] || 'Sin acceso';
  }
  fieldError(name: string) {
    const field = this.companyForm.get(name);
    if (!field?.touched || !field.invalid) return '';
    if (field.hasError('required')) return 'Completa este campo.';
    if (field.hasError('email')) return 'Escribe un correo válido.';
    if (field.hasError('minlength'))
      return name === 'admin_password'
        ? 'Usa al menos 12 caracteres.'
        : 'Escribe al menos 2 caracteres.';
    if (field.hasError('maxlength')) return 'El texto es demasiado largo.';
    return 'Usa letras minúsculas, números y guiones.';
  }
  openCompany() {
    this.companyForm.reset({
      name: '',
      slug: '',
      admin_name: '',
      admin_email: '',
      admin_password: '',
      plan_id: this.plans().find((p) => p.active)?.id || 1,
      address: '',
      phone: '',
      contact_email: '',
      activation: 'CHECKOUT',
      ends_at: this.futureDate(),
    });
    this.step.set(1);
    this.error.set('');
    this.showPassword.set(false);
    this.companyDialog?.nativeElement.showModal();
  }
  nextStep() {
    const fields =
      this.step() === 1
        ? ['name', 'slug', 'contact_email']
        : ['admin_name', 'admin_email', 'admin_password'];
    fields.forEach((name) => this.companyForm.get(name)?.markAsTouched());
    if (fields.every((name) => this.companyForm.get(name)?.valid))
      this.step.update((value) => value + 1);
  }
  generatePassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#';
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    this.companyForm.controls.admin_password.setValue(
      Array.from(bytes, (b) => alphabet[b % alphabet.length]).join(''),
    );
    this.showPassword.set(true);
  }
  copyLink(slug: string) {
    navigator.clipboard
      ?.writeText(this.storeLink(slug))
      .then(() => this.notice.set('Enlace de tienda copiado.'))
      .catch(() =>
        this.notice.set('Puedes copiar el enlace que aparece debajo del nombre de la empresa.'),
      );
  }
  private fail(error: unknown) {
    this.error.set(saasError(error));
    this.busy.set(false);
  }
  private begin() {
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
  }
  private done(message: string) {
    this.busy.set(false);
    this.notice.set(message);
    this.load();
  }
  create() {
    this.companyForm.markAllAsTouched();
    if (this.companyForm.invalid || this.busy()) return;
    const value = this.companyForm.getRawValue();
    if (
      value.activation === 'ADMINISTRATIVE' &&
      (!value.ends_at || new Date(value.ends_at + 'T23:59:59') <= new Date())
    ) {
      this.error.set('Elige una fecha de vencimiento futura.');
      return;
    }
    const payload = {
      ...value,
      name: value.name.trim(),
      admin_name: value.admin_name.trim(),
      admin_email: value.admin_email.trim().toLowerCase(),
      slug: value.slug.trim() || undefined,
      contact_email: value.contact_email.trim() || null,
      ends_at:
        value.activation === 'ADMINISTRATIVE'
          ? new Date(value.ends_at + 'T23:59:59').toISOString()
          : null,
    };
    this.begin();
    this.service.createTenant(payload).subscribe({
      next: (row) => {
        this.created.set(row);
        this.companyDialog?.nativeElement.close();
        this.companyForm.controls.admin_password.reset();
        this.done(
          row.access_active
            ? 'Empresa creada y lista para configurar.'
            : 'Empresa creada. Su administrador puede entrar y contratar el plan.',
        );
      },
      error: (e) => this.fail(e),
    });
  }
  toggle(row: CompanySubscription) {
    if (
      row.tenant.active &&
      !window.confirm(
        '¿Suspender el acceso de ' +
          row.tenant.name +
          '? Sus datos se conservan. Los cobros de Stripe se gestionan por separado.',
      )
    )
      return;
    this.begin();
    this.service.state(row.tenant.id, !row.tenant.active).subscribe({
      next: () =>
        this.done(
          'Acceso empresarial actualizado; la facturación Stripe se gestiona por separado.',
        ),
      error: (e) => this.fail(e),
    });
  }
  editPlan(plan: SaaSPlan) {
    this.editingPlan.set(plan);
    this.priceForm.patchValue({
      interval: 'month',
      amount: plan.monthly_amount_minor / 100,
      currency: plan.currency,
    });
    this.planForm.patchValue({
      ...plan,
      ...plan.features,
      stripe_price_id: plan.stripe_price_id || '',
    });
  }
  changePriceInterval() {
    const plan = this.editingPlan();
    if (plan)
      this.priceForm.controls.amount.setValue(
        (this.priceForm.controls.interval.value === 'year'
          ? plan.annual_amount_minor
          : plan.monthly_amount_minor) / 100,
      );
  }
  savePlan() {
    const plan = this.editingPlan();
    if (!plan || this.planForm.invalid) return;
    this.begin();
    const value = this.planForm.getRawValue();
    const features = Object.fromEntries(
      this.featureLabels.map((f) => [f.key, value[f.key as keyof typeof value]]),
    );
    this.service
      .savePlan(plan.id, {
        name: value.name,
        max_branches: value.max_branches,
        active: value.active,
        stripe_price_id: value.stripe_price_id.trim() || null,
        features,
      })
      .subscribe({
        next: (p) => {
          this.editingPlan.set(p);
          this.done('Plan actualizado. Los límites también se validan en el backend.');
        },
        error: (e) => this.fail(e),
      });
  }
  configurePrice() {
    const plan = this.editingPlan();
    if (!plan || this.priceForm.invalid) return;
    this.begin();
    const value = this.priceForm.getRawValue();
    this.service
      .configurePrice(plan.id, {
        billing_interval: value.interval,
        currency: value.currency,
        amount_minor: Math.round(value.amount * 100),
      })
      .subscribe({
        next: (p) => {
          this.editPlan(p);
          this.done('Precio creado en Stripe. No se ha cobrado a ningún cliente.');
        },
        error: (e) => this.fail(e),
      });
  }
  editLicense(row: CompanySubscription) {
    this.editingTenant.set(row);
    this.error.set('');
    this.licenseDialog?.nativeElement.showModal();
    const format = (value: string | null | undefined) => {
      if (!value) return '';
      const date = new Date(value);
      return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };
    this.licenseForm.patchValue({
      plan_id: row.plan?.id || 1,
      status: ['ACTIVE', 'TRIALING', 'SUSPENDED', 'EXPIRED', 'CANCELED'].includes(
        row.subscription?.status || '',
      )
        ? row.subscription!.status
        : 'ACTIVE',
      starts_at: format(row.subscription?.starts_at || new Date().toISOString()),
      ends_at: format(
        row.subscription?.ends_at || new Date(Date.now() + 30 * 86400000).toISOString(),
      ),
    });
  }
  saveLicense() {
    const row = this.editingTenant();
    if (!row || this.licenseForm.invalid || this.busy() || row.subscription?.managed_by_stripe)
      return;
    const v = this.licenseForm.getRawValue();
    if (new Date(v.ends_at) <= new Date(v.starts_at)) {
      this.error.set('El vencimiento debe ser posterior al inicio.');
      return;
    }
    this.begin();
    this.service
      .license(row.tenant.id, {
        ...v,
        starts_at: new Date(v.starts_at).toISOString(),
        ends_at: new Date(v.ends_at).toISOString(),
      })
      .subscribe({
        next: (value) => {
          this.editingTenant.set(value);
          this.done('Suscripción administrativa actualizada.');
        },
        error: (e) => this.fail(e),
      });
  }
}
