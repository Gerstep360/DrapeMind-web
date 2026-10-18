import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/auth.service';
import { SaaSService, SaaSPlan, CompanySubscription, saasError } from '@core/saas.service';

@Component({
  selector: 'app-saas-platform',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './saas.scss',
  template: `<main class="saas-page saas-platform">
    <header class="page-header platform-header">
      <div>
        <span class="eyebrow">DrapeMind · Administración SaaS</span>
        <h1>Empresas que visten su negocio.</h1>
        <p>Una plataforma, información independiente para cada empresa.</p>
      </div>
      <button class="btn btn-secondary" (click)="auth.logout()">Cerrar sesión</button>
    </header>
    @if (error()) {
      <p class="saas-error" role="alert">{{ error() }}</p>
    }
    @if (notice()) {
      <p class="saas-notice" role="status">{{ notice() }}</p>
    }
    <section class="saas-stats">
      <div>
        <span>Empresas</span><strong>{{ tenants().length }}</strong>
      </div>
      <div>
        <span>Con acceso activo</span><strong>{{ activeCount() }}</strong>
      </div>
      <div>
        <span>Planes</span><strong>{{ plans().length }}</strong>
      </div>
    </section>
    <section class="saas-panel">
      <div class="panel-heading">
        <h2>Empresas contratantes</h2>
        <button class="btn btn-secondary" (click)="load()">Actualizar</button>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Plan y capacidad</th>
              <th>Suscripción</th>
              <th>Vence</th>
              <th>Administrar</th>
            </tr>
          </thead>
          <tbody>
            @for (row of tenants(); track row.tenant.id) {
              <tr>
                <td>
                  <strong>{{ row.tenant.name }}</strong
                  ><small>{{ row.tenant.slug }}{{ row.tenant.is_demo ? ' · DEMO' : '' }}</small>
                </td>
                <td>
                  {{ row.plan?.name || 'Sin plan'
                  }}<small
                    >{{ row.active_branches }} / {{ row.plan?.max_branches }} sucursales</small
                  >
                </td>
                <td>
                  {{ row.access_active ? 'Activa' : 'Sin acceso'
                  }}<small>{{ row.subscription?.source || 'Sin contrato' }}</small>
                </td>
                <td>{{ (row.subscription?.ends_at | date: 'dd/MM/yyyy') || '—' }}</td>
                <td>
                  <button class="table-action" (click)="editLicense(row)">Suscripción</button
                  ><button class="table-action" [disabled]="busy()" (click)="toggle(row)">
                    {{ row.tenant.active ? 'Suspender acceso' : 'Habilitar acceso' }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5">Todavía no hay empresas contratantes.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
    <div class="saas-admin-grid">
      <section class="saas-panel">
        <h2>Registrar empresa</h2>
        <p class="saas-muted">
          El administrador podrá iniciar sesión y contratar el plan con Stripe. La empresa empieza
          sin acceso comercial hasta activar su suscripción.
        </p>
        <form [formGroup]="companyForm" (ngSubmit)="create()">
          <label>Nombre de empresa<input formControlName="name" /></label
          ><label
            >Identificador de acceso<input formControlName="slug" placeholder="mi-empresa" /></label
          ><label>Nombre del administrador<input formControlName="admin_name" /></label
          ><label
            >Correo del administrador<input type="email" formControlName="admin_email" /></label
          ><label
            >Contraseña inicial<input
              type="password"
              autocomplete="new-password"
              formControlName="admin_password" /></label
          ><label
            >Plan<select formControlName="plan_id">
              @for (plan of plans(); track plan.id) {
                <option [ngValue]="plan.id">{{ plan.name }}</option>
              }
            </select></label
          ><button class="btn btn-primary" [disabled]="companyForm.invalid || busy()">
            Crear empresa
          </button>
        </form>
      </section>
      <section class="saas-panel">
        <h2>Planes configurables</h2>
        <div class="plan-tabs">
          @for (plan of plans(); track plan.id) {
            <button class="table-action" (click)="editPlan(plan)">{{ plan.name }}</button>
          }
        </div>
        @if (editingPlan(); as plan) {
          <form [formGroup]="planForm" (ngSubmit)="savePlan()">
            <label>Nombre<input formControlName="name" /></label
            ><label
              >Límite de sucursales activas<input
                type="number"
                min="1"
                formControlName="max_branches" /></label
            ><label
              >Precio mensual en Stripe (Price ID)<input
                formControlName="stripe_price_id"
                placeholder="price_…"
            /></label>
            <div class="feature-toggles">
              @for (feature of featureLabels; track feature.key) {
                <label
                  ><input type="checkbox" [formControlName]="feature.key" />{{
                    feature.label
                  }}</label
                >
              }
            </div>
            <label><input type="checkbox" formControlName="active" />Plan disponible</label
            ><button class="btn btn-primary" [disabled]="planForm.invalid || busy()">
              Guardar configuración
            </button>
          </form>
          <hr />
          <h3>Publicar precio en Stripe</h3>
          <p class="saas-muted">
            Crea un precio para nuevas contrataciones. Los contratos existentes conservan su precio.
          </p>
          <form [formGroup]="priceForm" (ngSubmit)="configurePrice()">
            <label
              >Modalidad<select formControlName="interval">
                <option value="month">Mensual</option>
                <option value="year">Anual</option>
              </select></label
            ><label
              >Importe<input type="number" min="1" step="0.01" formControlName="amount" /></label
            ><label
              >Moneda<select formControlName="currency">
                <option value="bob">BOB</option>
                <option value="usd">USD</option>
              </select></label
            ><button class="btn btn-secondary" [disabled]="priceForm.invalid || busy()">
              Crear precio en Stripe
            </button>
          </form>
        } @else {
          <p class="saas-muted">Selecciona un plan para editar sus límites y funcionalidades.</p>
        }
      </section>
    </div>
    @if (editingTenant(); as tenant) {
      <section class="saas-panel" id="license-editor">
        <h2>Suscripción de {{ tenant.tenant.name }}</h2>
        <p class="saas-muted">
          La asignación administrativa sirve para demostraciones o contratos autorizados; no
          registra un pago Stripe. Suspender el acceso de una empresa no cancela su facturación.
        </p>
        <form class="license-form" [formGroup]="licenseForm" (ngSubmit)="saveLicense()">
          <label
            >Plan<select formControlName="plan_id">
              @for (plan of plans(); track plan.id) {
                <option [ngValue]="plan.id">{{ plan.name }}</option>
              }
            </select></label
          ><label
            >Estado<select formControlName="status">
              <option value="ACTIVE">Activa</option>
              <option value="TRIALING">Prueba</option>
              <option value="SUSPENDED">Suspendida</option>
              <option value="EXPIRED">Vencida</option>
              <option value="CANCELED">Cancelada</option>
            </select></label
          ><label>Inicio<input type="datetime-local" formControlName="starts_at" /></label
          ><label>Vencimiento<input type="datetime-local" formControlName="ends_at" /></label
          ><button
            class="btn btn-primary"
            [disabled]="licenseForm.invalid || busy() || tenant.subscription?.source === 'STRIPE'"
          >
            Guardar asignación administrativa
          </button>
        </form>
        @if (tenant.subscription?.source === 'STRIPE') {
          <p class="saas-notice">
            Esta suscripción se administra mediante Stripe. No se sobrescriben sus cobros desde este
            formulario.
          </p>
        }
      </section>
    }
  </main>`,
})
export class PlatformComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly service = inject(SaaSService);
  private readonly fb = inject(FormBuilder);
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
    { key: 'offline', label: 'Offline' },
    { key: 'reports', label: 'Reportes normales' },
    { key: 'ai_reports', label: 'Reportes con IA' },
  ];
  readonly companyForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    admin_name: ['', [Validators.required]],
    admin_email: ['', [Validators.required, Validators.email]],
    admin_password: ['', [Validators.required, Validators.minLength(12)]],
    plan_id: [1, Validators.required],
  });
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
    this.service
      .tenants()
      .subscribe({ next: (rows) => this.tenants.set(rows), error: (e) => this.fail(e) });
    this.service
      .plans()
      .subscribe({ next: (plans) => this.plans.set(plans), error: (e) => this.fail(e) });
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
    if (this.companyForm.invalid) return;
    this.begin();
    this.service.createTenant(this.companyForm.getRawValue()).subscribe({
      next: () => {
        this.companyForm.controls.admin_password.reset();
        this.done('Empresa creada. El administrador puede contratar su plan.');
      },
      error: (e) => this.fail(e),
    });
  }
  toggle(row: CompanySubscription) {
    this.begin();
    this.service
      .state(row.tenant.id, !row.tenant.active)
      .subscribe({
        next: () =>
          this.done(
            'Acceso empresarial actualizado; la facturación Stripe se gestiona por separado.',
          ),
        error: (e) => this.fail(e),
      });
  }
  editPlan(plan: SaaSPlan) {
    this.editingPlan.set(plan);
    this.priceForm.patchValue({ amount: plan.monthly_amount_minor / 100, currency: plan.currency });
    this.planForm.patchValue({
      ...plan,
      ...plan.features,
      stripe_price_id: plan.stripe_price_id || '',
    });
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
    const format = (value: string | null | undefined) => {
      if (!value) return '';
      const date = new Date(value);
      return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };
    this.licenseForm.patchValue({
      plan_id: row.plan?.id || 1,
      status: row.subscription?.status || 'ACTIVE',
      starts_at: format(row.subscription?.starts_at),
      ends_at: format(row.subscription?.ends_at),
    });
  }
  saveLicense() {
    const row = this.editingTenant();
    if (!row || this.licenseForm.invalid) return;
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
