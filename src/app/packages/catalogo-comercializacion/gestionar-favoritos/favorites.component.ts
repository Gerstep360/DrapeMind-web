import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CatalogApiService } from '@core/api/catalog-api.service';
import { CartService } from '@core/cart.service';
import { Product } from '@core/models';
import { ToastService } from '@core/toast.service';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [DecimalPipe, RouterLink],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoritesComponent implements OnInit {
  private readonly catalogApi = inject(CatalogApiService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly favorites = signal<Product[]>([]);
  readonly processingId = signal<number | null>(null);

  ngOnInit(): void {
    this.loadFavorites();
  }

  loadFavorites(): void {
    this.loading.set(true);
    this.catalogApi.favorites().subscribe({
      next: (items) => {
        this.favorites.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.show(err.error?.detail || 'No se pudieron cargar los favoritos', 'error');
        this.loading.set(false);
      },
    });
  }

  removeFavorite(product: Product, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.processingId() === product.id) return;
    this.processingId.set(product.id);

    this.catalogApi.removeFavorite(product.id).subscribe({
      next: () => {
        this.favorites.update((list) => list.filter((p) => p.id !== product.id));
        this.toast.show(`"${product.nombre}" removido de favoritos`, 'success');
        this.processingId.set(null);
      },
      error: (err) => {
        this.toast.show(err.error?.detail || 'Error al remover de favoritos', 'error');
        this.processingId.set(null);
      },
    });
  }

  addDirectToCart(product: Product, event?: Event): void {
    if (event) event.stopPropagation();
    const variant = product.variantes?.[0];
    if (!variant) {
      this.toast.show('Esta prenda no tiene variantes activas disponibles', 'info');
      return;
    }
    this.cart.addItem(variant.id, 1);
    this.toast.show(`"${product.nombre}" añadido al perchero`, 'success');
  }

  imageUrl(product: Product): string | null {
    const first = product.imagenes?.[0];
    const raw = typeof first === 'string' ? first : first?.url;
    if (!raw || raw.toLowerCase().includes('placeholder')) {
      return null;
    }
    return raw;
  }
}
