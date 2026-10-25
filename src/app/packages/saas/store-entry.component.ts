import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth.service';
import { TenantService } from '@core/tenant.service';
import { saasError } from '@core/saas.service';

@Component({
  selector: 'app-store-entry',
  imports: [RouterLink],
  template: `<main>
    <p>DrapeMind · Tu cuenta, tus tiendas</p>
    <h1>{{ error() ? 'No pudimos abrir esta tienda' : 'Preparando tu visita…' }}</h1>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
      <a routerLink="/tiendas">Ver tiendas</a> · <a routerLink="/login">Entrar con otra cuenta</a>
    }
  </main>`,
  styles: `
    main {
      max-width: 560px;
      margin: 12vh auto;
      padding: 24px;
      color: var(--dm-ink);
    }
    h1 {
      font-size: 32px;
    }
    p {
      line-height: 1.6;
    }
    a {
      color: inherit;
    }
  `,
})
export class StoreEntryComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly tenant = inject(TenantService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly error = signal('');
  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    if (this.auth.hasValidToken() && this.auth.user()?.is_universal_customer) {
      this.auth
        .enterStore(slug)
        .subscribe({
          next: () => void this.router.navigateByUrl(this.auth.destination(), { replaceUrl: true }),
          error: (e) => this.error.set(saasError(e)),
        });
    } else if (this.auth.hasValidToken() && this.auth.user()?.tenant_slug === slug) {
      void this.router.navigateByUrl(this.auth.isStaff() ? '/dashboard' : '/catalog', {
        replaceUrl: true,
      });
    } else {
      this.tenant.enterStore(slug);
      void this.router.navigate(['/tienda', slug, 'login'], { replaceUrl: true });
    }
  }
}
