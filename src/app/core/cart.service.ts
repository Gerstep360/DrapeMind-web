import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { Cart, CartItem } from './models';
import { StoreApiService } from './store-api.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly api = inject(StoreApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly cart = signal<Cart | null>(null);
  readonly isOpen = signal<boolean>(false);
  readonly loading = signal<boolean>(false);

  readonly items = computed<CartItem[]>(() => this.cart()?.items ?? []);
  readonly totalItems = computed<number>(() => this.cart()?.total_items ?? 0);
  readonly subtotal = computed<number>(() => this.cart()?.subtotal ?? 0);

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.loadCart();
      } else {
        this.cart.set(null);
        this.isOpen.set(false);
      }
    });
  }

  loadCart(): void {
    if (!this.auth.isAuthenticated()) return;
    this.api.getCart().subscribe({
      next: (cart) => this.cart.set(cart),
      error: () => {},
    });
  }

  open(): void {
    this.isOpen.set(true);
    this.loadCart();
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  addItem(variantId: number, quantity = 1, customMessage?: string): void {
    if (!this.auth.isAuthenticated()) {
      this.toast.show('Inicia sesión para agregar productos al carrito', 'error');
      return;
    }
    this.loading.set(true);
    this.api.addCartItem(variantId, quantity).subscribe({
      next: (cart) => {
        this.cart.set(cart);
        this.loading.set(false);
        this.toast.show(customMessage || 'Prenda agregada a tu carrito ✨', 'success');
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.show(err?.error?.detail || 'No se pudo agregar la prenda', 'error');
      },
    });
  }

  addItems(
    items: Array<{ variante_id: number; cantidad?: number }>,
    customMessage = 'Outfit completo agregado a tu carrito',
  ): void {
    if (!this.auth.isAuthenticated()) {
      this.toast.show('Inicia sesión para agregar el outfit al carrito', 'error');
      return;
    }
    const validItems = items.filter((item) => item.variante_id > 0);
    if (!validItems.length || this.loading()) return;
    this.loading.set(true);
    this.api
      .addCartItemsBatch(
        validItems.map((item) => ({
          variante_id: item.variante_id,
          cantidad: item.cantidad ?? 1,
        })),
      )
      .subscribe({
        next: (cart) => {
          this.cart.set(cart);
          this.loading.set(false);
          this.toast.show(customMessage, 'success');
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.show(
            err?.error?.detail || 'No se pudo agregar el outfit completo',
            'error',
          );
        },
      });
  }

  replaceWithItems(
    items: Array<{ variante_id: number; cantidad?: number }>,
    customMessage = 'Tu carrito ahora contiene esta selección',
  ): void {
    if (!this.auth.isAuthenticated()) {
      this.toast.show('Inicia sesión para usar la selección', 'error');
      return;
    }
    const validItems = items.filter((item) => item.variante_id > 0);
    if (!validItems.length || this.loading()) return;
    this.loading.set(true);
    this.api
      .replaceCartItemsBatch(
        validItems.map((item) => ({
          variante_id: item.variante_id,
          cantidad: item.cantidad ?? 1,
        })),
      )
      .subscribe({
        next: (cart) => {
          this.cart.set(cart);
          this.loading.set(false);
          this.toast.show(customMessage, 'success');
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.show(
            err?.error?.detail || 'No se pudo reemplazar el carrito con esta selección',
            'error',
          );
        },
      });
  }

  updateQuantity(itemId: number, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(itemId);
      return;
    }
    this.loading.set(true);
    this.api.updateCartItem(itemId, quantity).subscribe({
      next: (cart) => {
        this.cart.set(cart);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.show(err?.error?.detail || 'No se pudo actualizar la cantidad', 'error');
      },
    });
  }

  removeItem(itemId: number): void {
    this.loading.set(true);
    this.api.deleteCartItem(itemId).subscribe({
      next: (cart) => {
        this.cart.set(cart);
        this.loading.set(false);
        this.toast.show('Prenda retirada del carrito', 'info');
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.show(err?.error?.detail || 'No se pudo eliminar el item', 'error');
      },
    });
  }

  setCart(cart: Cart | null): void {
    this.cart.set(cart);
  }
}
