import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { AuthService } from '@core/auth.service';
import { SaaSService, SaaSPlan, saasError } from '@core/saas.service';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [DatePipe, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="saas-page">
    <header class="page-header">
      <span class="eyebrow">Tu empresa en DrapeMind</span>
      <h1>Mi suscripción</h1>
      <p>Consulta el acceso, la capacidad y la facturación de tu empresa.</p>
    </header>
    @if (error()) {
      <p role="alert" class="saas-error">{{ error() }}</p>
    }
    @if (service.current(); as state) {
      <section class="license-overview">
        <div>
          <span class="eyebrow">{{ state.tenant.slug }}</span>
          <h2>{{ state.tenant.name }}</h2>
          <p>
            {{ state.access_active ? 'Acceso activo' : 'Acceso pendiente o vencido' }} ·
            {{ state.plan?.name || 'Sin plan' }}
          </p>
          <p class="saas-muted">
            {{
              state.subscription?.source === 'STRIPE'
                ? 'Facturación con Stripe'
                : 'Asignación administrativa, sin cobro Stripe'
            }}
          </p>
        </div>
        <dl>
          <div>
            <dt>Sucursales activas</dt>
            <dd>{{ state.active_branches }} / {{ state.plan?.max_branches || 0 }}</dd>
          </div>
          <div>
            <dt>Vencimiento</dt>
            <dd>{{ (state.subscription?.ends_at | date: 'dd/MM/yyyy') || 'Por confirmar' }}</dd>
          </div>
        </dl>
      </section>
      @if (state.subscription?.cancel_at_period_end) {
        <p class="saas-notice">
          La renovación está cancelada. El acceso continúa hasta la fecha indicada.
        </p>
      }
      @if (!state.access_active) {
        <p class="saas-notice">
          El catálogo y las operaciones quedan bloqueados hasta activar la suscripción. Los datos de
          la empresa se conservan.
        </p>
      }
      @if (auth.user()?.rol === 'ADMIN') {
        <div class="billing-actions">
          <button
            class="btn btn-primary"
            [disabled]="busy() || !state.portal_available"
            (click)="portal()"
          >
            Gestionar con Stripe ↗</button
          ><button class="btn btn-secondary" [disabled]="busy()" (click)="load()">
            Actualizar estado
          </button>
          <p class="saas-muted">
            Stripe muestra facturas, medios de pago, cambios de plan y cancelación. El acceso se
            confirma desde el servidor.
          </p>
        </div>
      }
    }
    <div class="plan-tabs" role="group" aria-label="Modalidad de pago">
      <button
        class="btn"
        [class.btn-primary]="interval() === 'month'"
        (click)="changeInterval('month')"
      >
        Mensual</button
      ><button
        class="btn"
        [class.btn-primary]="interval() === 'year'"
        (click)="changeInterval('year')"
      >
        Anual · 2 meses de ahorro
      </button>
    </div>
    <section class="saas-plans" aria-label="Planes empresariales">
      @for (plan of plans(); track plan.id) {
        <article class="saas-plan" [class.saas-plan--pro]="plan.code === 'PRO'">
          <span class="eyebrow">{{ plan.code === 'PRO' ? 'Para crecer' : 'Lo esencial' }}</span>
          <h2>{{ plan.name }}</h2>
          <p class="plan-capacity">{{ plan.max_branches }} <span>sucursales activas</span></p>
          <p class="plan-price">
            @if (prices()[plan.id]; as price) {
              {{ price.amount_minor / 100 | currency: price.currency.toUpperCase() }}
              <span>/ {{ interval() === 'month' ? 'mes' : 'año' }}</span>
            } @else {
              {{
                (interval() === 'month' ? plan.monthly_amount_minor : plan.annual_amount_minor) /
                  100 | currency: plan.currency.toUpperCase()
              }}
              <span>/ {{ interval() === 'month' ? 'mes' : 'año' }}</span>
            }
          </p>
          <ul>
            @for (feature of featureLabels; track feature.key) {
              <li [class.is-unavailable]="!plan.features[feature.key]">
                <span aria-hidden="true">{{ plan.features[feature.key] ? '✓' : '—' }}</span
                >{{ feature.label }}
              </li>
            }
          </ul>
          @if (auth.user()?.rol === 'ADMIN') {
            <button
              class="btn"
              [class.btn-primary]="plan.code === 'PRO'"
              [disabled]="
                busy() ||
                !plan.active ||
                !(interval() === 'month'
                  ? plan.checkout_available
                  : plan.annual_checkout_available) ||
                service.current()?.portal_available
              "
              (click)="subscribe(plan.id)"
            >
              Contratar con Stripe ↗
            </button>
          }
        </article>
      }
    </section>
    <p class="saas-muted">
      Los precios se confirman en Stripe antes del pago. Si ya tienes una suscripción Stripe, cambia
      el plan desde su portal. Para bajar de plan, primero ajusta las sucursales al límite de
      destino.
    </p>
  </main>`,
  styleUrl: './saas.scss',
})
export class SubscriptionComponent implements OnInit {
  readonly interval = signal<'month' | 'year'>('month');
  readonly auth = inject(AuthService);
  readonly service = inject(SaaSService);
  readonly plans = signal<SaaSPlan[]>([]);
  readonly prices = signal<Record<number, { amount_minor: number; currency: string }>>({});
  readonly error = signal('');
  readonly busy = signal(false);
  readonly featureLabels = [
    { key: 'products_sales', label: 'Productos y ventas' },
    { key: 'reservations', label: 'Reservas' },
    { key: 'offline', label: 'Acceso offline' },
    { key: 'reports', label: 'Reportes normales' },
    { key: 'ai_reports', label: 'Reportes con IA' },
  ];
  ngOnInit() {
    this.load();
  }
  changeInterval(value: 'month' | 'year') {
    this.interval.set(value);
    this.prices.set({});
    this.load(false);
  }
  load(refresh = true) {
    const interval = this.interval();
    this.error.set('');
    this.busy.set(true);
    const request =
      refresh && this.auth.user()?.rol === 'ADMIN' ? this.service.sync() : this.service.load();
    request.subscribe({
      next: () => this.busy.set(false),
      error: (e) => {
        this.busy.set(false);
        this.error.set(saasError(e));
        this.service.load().subscribe({ error: () => {} });
      },
    });
    this.service.plans().subscribe({
      next: (plans) => {
        this.plans.set(plans);
        for (const plan of plans)
          if (interval === 'month' ? plan.checkout_available : plan.annual_checkout_available)
            this.service.price(plan.id, interval).subscribe({
              next: (price) => {
                if (this.interval() === interval)
                  this.prices.update((v) => ({ ...v, [plan.id]: price }));
              },
              error: () => {},
            });
      },
      error: (e) => this.error.set(saasError(e)),
    });
  }
  subscribe(id: number) {
    this.busy.set(true);
    this.error.set('');
    this.service.checkout(id, this.interval()).subscribe({
      next: (response) => {
        if (response.synchronized) {
          this.busy.set(false);
          this.load(false);
        } else if (response.url) this.service.openStripe(response.url);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(saasError(e));
      },
    });
  }
  portal() {
    this.busy.set(true);
    this.error.set('');
    this.service.portal().subscribe({
      next: (response) => this.service.openStripe(response.url),
      error: (e) => {
        this.busy.set(false);
        this.error.set(saasError(e));
      },
    });
  }
}
