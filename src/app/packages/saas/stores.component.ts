import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { RuntimeConfigService } from '@core/runtime-config.service';
import { AuthService } from '@core/auth.service';
@Component({
  selector: 'app-stores',
  imports: [RouterLink],
  template: `<main>
    <header>
      <a routerLink="/catalog">DrapeMind</a>
      <p>Una cuenta para todas tus tiendas</p>
      <h1>Encuentra tu próxima tienda.</h1>
      <p>
        Elige dónde comprar. Tu carrito, pedidos y disponibilidad corresponden siempre a la tienda
        que visitas.
      </p>
    </header>
    @if (auth.user()?.rol === 'CLIENTE' && auth.destination() === '/tiendas') {
      <p role="status">
        La tienda que visitabas no está recibiendo compras por ahora. Puedes visitar otra con tu
        misma cuenta.
      </p>
    }
    @if (error()) {
      <p role="alert">{{ error() }}</p>
      <button (click)="load()">Reintentar</button>
    }
    <section>
      @for (store of stores(); track store.slug) {
        <a class="store" [routerLink]="['/tienda', store.slug]"
          ><span aria-hidden="true">{{ store.name.slice(0, 1) }}</span>
          <h2>{{ store.name }}</h2>
          <p>Visitar tienda ↗</p></a
        >
      } @empty {
        <p>{{ loading() ? 'Buscando tiendas…' : 'Aún no hay tiendas disponibles.' }}</p>
      }
    </section>
  </main>`,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: var(--dm-paper);
      color: var(--dm-ink);
    }
    main {
      max-width: 1120px;
      margin: auto;
      padding: 40px 24px;
    }
    header {
      max-width: 670px;
      margin-bottom: 36px;
    }
    h1 {
      font-size: clamp(30px, 5vw, 48px);
      letter-spacing: -0.04em;
    }
    p {
      line-height: 1.6;
    }
    a {
      color: inherit;
    }
    section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px;
    }
    .store {
      border: 2px solid var(--dm-ink);
      padding: 24px;
      text-decoration: none;
      background: var(--dm-surface);
      transition: transform 0.2s;
    }
    .store:hover {
      transform: translateY(-3px);
      box-shadow: 4px 4px 0 var(--dm-ink);
    }
    .store > span {
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      background: var(--dm-lime);
      font-size: 24px;
      font-weight: 800;
    }
    .store p {
      font-size: 13px;
    }
    @media (prefers-reduced-motion: reduce) {
      .store {
        transition: none;
      }
    }
  `,
})
export class StoresComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);
  readonly stores = signal<{ slug: string; name: string }[]>([]);
  readonly error = signal('');
  readonly loading = signal(false);
  ngOnInit() {
    this.load();
  }
  load() {
    this.loading.set(true);
    this.error.set('');
    this.http
      .get<{ slug: string; name: string }[]>(this.runtime.apiUrl + '/saas/companies')
      .subscribe({
        next: (rows) => {
          this.stores.set(rows);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No pudimos cargar las tiendas. Intenta nuevamente.');
          this.loading.set(false);
        },
      });
  }
}
