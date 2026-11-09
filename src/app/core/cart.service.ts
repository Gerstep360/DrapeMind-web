import {firstValueFrom} from 'rxjs';
import {LocalCartService} from '../segundo_parcial/cu22_carrito_checkout/cu22-carrito-local.service';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { Cart, CartItem } from './models';
import { CommerceApiService } from './api/commerce-api.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly api = inject(CommerceApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly local=inject(LocalCartService);
  readonly localIssue=this.local.issue;
  readonly cart = signal<Cart | null>(null);
  readonly isOpen = signal<boolean>(false);
  readonly loading = signal<boolean>(false);

  readonly items = computed<CartItem[]>(() => this.cart()?.items ?? []);
  readonly totalItems = computed<number>(() => this.cart()?.total_items ?? 0);
  readonly subtotal = computed<number>(() => this.cart()?.subtotal ?? 0);

  // Soporte de Cupones y Promociones
  readonly appliedPromo = signal<{
    codigo: string;
    descuento_calculado: number;
    mensaje: string;
    tipo_descuento?: string;
  } | null>(null);

  readonly discountAmount = computed<number>(() => this.appliedPromo()?.descuento_calculado ?? 0);
  readonly totalWithDiscount = computed<number>(() => Math.max(0, this.subtotal() - this.discountAmount()));

  setPromo(promo: { codigo: string; descuento_calculado: number; mensaje: string; tipo_descuento?: string } | null): void {
    this.appliedPromo.set(promo);
  }

  clearPromo(): void {
    this.appliedPromo.set(null);
  }

  constructor() {
    effect(()=>{this.cart.set(this.local.current());});
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
    const requestOwner=this.local.scopeKey();
    if (!this.auth.isAuthenticated()) return;
    void this.local.ready.then(()=>{
      if(requestOwner!==this.local.scopeKey())return;
      if(this.local.active()){void this.local.synchronize();return;}
      this.api.getCart().subscribe({next:cart=>{if(requestOwner===this.local.scopeKey()){void this.local.acceptServer(cart,requestOwner);this.cart.set(cart);}},error:()=>{}});
    });
  }

  open(): void {
    this.isOpen.set(true);
    if (!this.loading() && !this.cart()) {
      this.loadCart();
    }
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

  addItem(variantId: number, quantity = 1, customMessage?: string, openDrawer = false): void {
    const requestOwner=this.local.scopeKey();
    if(this.local.active()){this.editLocal('add',[{variante_id:variantId,cantidad:quantity}]);if(openDrawer)this.open();return;}
    if (!this.auth.isAuthenticated()) {
      this.toast.show('Inicia sesión para agregar productos al carrito', 'error');
      return;
    }
    this.loading.set(true);
    this.api.addCartItem(variantId, quantity).subscribe({
      next: (cart) => {
          if(requestOwner!==this.local.scopeKey())return;
          void this.local.acceptServer(cart,requestOwner);
        this.cart.set(cart);
        this.loading.set(false);
        if (openDrawer) {
          this.isOpen.set(true);
        }
        this.toast.show(customMessage || 'Prenda agregada a tu carrito', 'success');
      },
      error: (err) => {
          if(requestOwner!==this.local.scopeKey())return;
        this.loading.set(false);
        this.toast.show(err?.error?.detail || 'No se pudo agregar la prenda', 'error');
      },
    });
  }

  addItems(
    items: Array<{ variante_id: number; cantidad?: number }>,
    customMessage = 'Outfit completo agregado a tu carrito',
  ): void {
    const requestOwner=this.local.scopeKey();
    if(this.local.active()){this.editLocal('add',items.map(i=>({variante_id:i.variante_id,cantidad:i.cantidad??1})));return;}
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
          if(requestOwner!==this.local.scopeKey())return;
          void this.local.acceptServer(cart,requestOwner);
          this.cart.set(cart);
          this.loading.set(false);
          this.toast.show(customMessage, 'success');
        },
        error: (err) => {
          if(requestOwner!==this.local.scopeKey())return;
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
    fromAi = false,
  ): void {
    const requestOwner=this.local.scopeKey();
    if(this.local.active()){this.editLocal('replace',items.map(i=>({variante_id:i.variante_id,cantidad:i.cantidad??1})));return;}
    if (!this.auth.isAuthenticated()) {
      this.toast.show('Inicia sesión para usar la selección', 'error');
      return;
    }
    const validItems = items.filter((item) => item.variante_id > 0);
    if (!validItems.length || this.loading()) return;
    this.loading.set(true);
    const selection = validItems.map((item) => ({
          variante_id: item.variante_id,
          cantidad: item.cantidad ?? 1,
        }));
    (fromAi ? this.api.applyAiSelection(selection) : this.api.replaceCartItemsBatch(selection))
      .subscribe({
        next: (cart) => {
          if(requestOwner!==this.local.scopeKey())return;
          void this.local.acceptServer(cart,requestOwner);
          this.cart.set(cart);
          this.loading.set(false);
          this.toast.show(customMessage, 'success');
        },
        error: (err) => {
          if(requestOwner!==this.local.scopeKey())return;
          this.loading.set(false);
          this.toast.show(
            err?.error?.detail || 'No se pudo reemplazar el carrito con esta selección',
            'error',
          );
        },
      });
  }

  updateQuantity(itemId: number, quantity: number): void {
    const requestOwner=this.local.scopeKey();
    if(this.local.active()){if(quantity<=0)this.editLocal('remove',[],itemId);else this.editLocal('quantity',[],itemId,quantity);return;}
    if (quantity <= 0) {
      this.removeItem(itemId);
      return;
    }
    this.loading.set(true);
    this.api.updateCartItem(itemId, quantity).subscribe({
      next: (cart) => {
          if(requestOwner!==this.local.scopeKey())return;
          void this.local.acceptServer(cart,requestOwner);
        this.cart.set(cart);
        this.loading.set(false);
      },
      error: (err) => {
          if(requestOwner!==this.local.scopeKey())return;
        this.loading.set(false);
        this.toast.show(err?.error?.detail || 'No se pudo actualizar la cantidad', 'error');
      },
    });
  }

  removeItem(itemId: number): void {
    const requestOwner=this.local.scopeKey();
    if(this.local.active()){this.editLocal('remove',[],itemId);return;}
    this.loading.set(true);
    this.api.deleteCartItem(itemId).subscribe({
      next: (cart) => {
          if(requestOwner!==this.local.scopeKey())return;
          void this.local.acceptServer(cart,requestOwner);
        this.cart.set(cart);
        this.loading.set(false);
        this.toast.show('Prenda retirada del carrito', 'info');
      },
      error: (err) => {
          if(requestOwner!==this.local.scopeKey())return;
        this.loading.set(false);
        this.toast.show(err?.error?.detail || 'No se pudo eliminar el item', 'error');
      },
    });
  }

  setCart(cart: Cart | null): void {
    this.cart.set(cart);
  }
  async synchronizeDraft(){await this.local.synchronize();if(this.local.dirty()&&this.local.issue())throw new Error(this.local.issue());}
  async prepareDownload(){
    await this.local.ready;await this.synchronizeDraft();
    const owner=this.local.scopeKey();
    const cart=await firstValueFrom(this.api.getCart());
    if(owner!==this.local.scopeKey())return;
    await this.local.acceptServer(cart,owner);this.cart.set(this.local.current()||cart);
  }
  private editLocal(action:'add'|'replace'|'quantity'|'remove',items:{variante_id:number;cantidad:number}[]=[],id?:number,quantity?:number){
    const owner=this.local.scopeKey();this.loading.set(true);this.clearPromo();
    void this.local.edit(action,items,id,quantity).catch(error=>{if(owner===this.local.scopeKey())this.toast.show(error.message||'No se pudo guardar el carrito.','error');}).finally(()=>{if(owner===this.local.scopeKey())this.loading.set(false);});
  }

}
