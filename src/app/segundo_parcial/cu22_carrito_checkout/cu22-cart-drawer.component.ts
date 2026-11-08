import { ProductMediaComponent } from '../../shared/components/product-media/product-media.component';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { BranchService } from '../../core/branch.service';
import { CartService } from '../../core/cart.service';
import { Address, Order, Payment, Promotion } from '../../core/models';
import { AccountApiService } from '../../core/api/account-api.service';
import { CommerceApiService } from '../../core/api/commerce-api.service';
import { ToastService } from '../../core/toast.service';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import {
  garmentPresentationType,
  hasUsableGarmentImage,
} from '../../shared/presentation/garment-presentation';
import { ReceiptModalComponent } from '../cu21_comprobantes/cu21-receipt-modal.component';
import { StripePaymentComponent } from '../cu23_pagos/cu23-pago.component';
import { CartDrawerStep } from './cu22-cart-drawer.models';

@Component({
  selector: 'app-cart-drawer',
  imports: [
    ProductMediaComponent,
    ReactiveFormsModule,
    DecimalPipe,
    ReceiptModalComponent,
    StripePaymentComponent,
  ],
  templateUrl: './cu22-cart-drawer.component.html',
  styleUrl: './cu22-cart-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartDrawerComponent {
  openDeferredPurchase(): void { this.cart.close(); void this.router.navigateByUrl('/pending-purchases'); }
  stripePaid(payment: Payment): void {
    this.lastPayment.set(payment);
    const order = this.lastOrder();
    if (order && payment.estado === 'APROBADO') this.lastOrder.set({ ...order, estado: 'PAGADO' });
  }
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);
  readonly branches = inject(BranchService);
  readonly runtime = inject(RuntimeConfigService);
  private readonly commerceApi = inject(CommerceApiService);
  private readonly accountApi = inject(AccountApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly checkoutBranches=signal<{id:number;nombre:string;direccion?:string;disponible:boolean}[]>([]);
  readonly checkingAvailability=signal(false);
  readonly checkoutError=signal('');
  readonly step = signal<CartDrawerStep>('CART');
  readonly deliveryFee=signal<number|null>(null);
  readonly processing = signal<boolean>(false);
  readonly addresses = signal<Address[]>([]);
  readonly selectedAddressId = signal<number | null>(null);
  readonly showNewAddressForm = signal<boolean>(false);

  // Success state data
  readonly lastOrder = signal<Order | null>(null);
  readonly lastPayment = signal<Payment | null>(null);
  readonly lastPaymentMethod = signal<string>('TARJETA');
  readonly payingMock = signal<boolean>(false);
  readonly showReceiptModal = signal<boolean>(false);

  readonly checkoutForm = this.fb.nonNullable.group({
    sucursal_id: [null as number | null],
    tipo_entrega: ['RECOJO' as 'DELIVERY' | 'RECOJO' | 'TIENDA', Validators.required],
    metodo_pago: ['TARJETA' as 'TARJETA', Validators.required],
    observacion: [''],
    // Inline address fields if needed
    departamento: ['Santa Cruz'],
    ciudad: ['Santa Cruz de la Sierra'],
    zona: ['Equipetrol / Centro'],
    direccion: [''],
    telefono_contacto: [''],
  });

  hasRealImage(url: string | null | undefined): boolean {
    return hasUsableGarmentImage(url);
  }

  getGarmentType(name: string) {
    return garmentPresentationType(name);
  }

  // Cupones y Promociones
  readonly availablePromotions = signal<Promotion[]>([]);
  readonly promoInput = signal<string>('');
  readonly validatingPromo = signal<boolean>(false);

  constructor() {
    effect(() => {
      if (this.cart.isOpen()) {
        this.commerceApi.shippingConfiguration().subscribe({next:config=>this.deliveryFee.set(+config.costo_delivery),error:()=>this.deliveryFee.set(null)});
        this.branches.loadBranches();
        this.loadAddresses();
        this.loadPromotions();
      } else {
        // Reset to cart view when drawer is closed
        setTimeout(() => this.step.set('CART'), 300);
      }
    });
  }

  loadPromotions(): void {
    this.commerceApi.listActivePromotions().subscribe({
      next: (promos) => this.availablePromotions.set(promos || []),
      error: () => {},
    });
  }

  quickApplyPromo(code: string): void {
    this.promoInput.set(code);
    this.applyPromo(code);
  }

  applyPromo(codeOverride?: string): void {
    const code = (codeOverride || this.promoInput()).trim().toUpperCase();
    if (!code) {
      this.toast.show('Ingresa o selecciona un código promocional', 'info');
      return;
    }
    if (this.cart.subtotal() <= 0) {
      this.toast.show('Tu perchero está vacío', 'info');
      return;
    }
    this.validatingPromo.set(true);
    const prodIds = this.cart.items().map((it) => it.producto_id);
    this.commerceApi
      .validatePromotion({
        codigo: code,
        monto_subtotal: this.cart.subtotal(),
        item_producto_ids: prodIds,
      })
      .subscribe({
        next: (res) => {
          this.validatingPromo.set(false);
          if (res.valido) {
            this.cart.setPromo({
              codigo: res.codigo,
              descuento_calculado: Number(res.descuento_calculado || 0),
              mensaje: res.mensaje,
              tipo_descuento: res.tipo_descuento,
            });
            this.toast.show(
              `¡Cupón "${res.codigo}" aplicado con éxito! Ahorras Bs ${Number(res.descuento_calculado).toFixed(2)}`,
              'success',
            );
            this.promoInput.set('');
          } else {
            this.toast.show(
              res.mensaje || 'El cupón no es válido para los productos o montos de este pedido',
              'error',
            );
          }
        },
        error: (err) => {
          this.validatingPromo.set(false);
          this.toast.show(err.error?.detail || 'Error al validar cupón', 'error');
        },
      });
  }

  removePromo(): void {
    this.cart.clearPromo();
    this.toast.show('Cupón retirado de la orden', 'info');
  }

  goToOptimizer(): void {
    this.cart.close();
    this.router.navigate(['/cart-optimizer']);
  }

  addSuggestedToCart(item: any): void {
    const variantId = item.variantes?.[0]?.id || item.variante_id || item.id;
    if (variantId) {
      this.cart.addItem(variantId, 1);
      this.toast.show('Prenda sugerida añadida al perchero', 'success');
    }
  }

  analyzeWithAi(): void {
    this.goToOptimizer();
  }

  loadAddresses(): void {
    if (!this.auth.isAuthenticated()) return;
    this.accountApi.myAddresses().subscribe({
      next: (addrs) => {
        this.addresses.set(addrs);
        const principal = addrs.find((a) => a.es_principal) || addrs[0];
        if (principal) {
          this.selectedAddressId.set(principal.id);
        } else {
          this.showNewAddressForm.set(true);
        }
      },
      error: () => {},
    });
  }

  goToCheckout(): void {
    if (this.cart.totalItems() === 0) return;
    this.step.set('CHECKOUT');
    this.checkoutError.set('');this.checkingAvailability.set(true);
    this.commerceApi.checkoutOptions().subscribe({next:options=>{
      this.checkingAvailability.set(false);this.checkoutBranches.set(options.sucursales);
      if(options.compra_pendiente){this.checkoutError.set('Estas prendas ya tienen una compra pendiente. Revisa su pago antes de crear otra.');return;}
      if(options.vacio){this.checkoutError.set('Tu carrito ya cambió o se confirmó. Revisa Mis pedidos y actualiza el carrito.');this.cart.loadCart();return;}
      const selected=this.checkoutForm.controls.sucursal_id.value;
      if(!options.sucursales.some(b=>b.id===selected&&b.disponible))this.checkoutForm.controls.sucursal_id.setValue(options.sucursales.find(b=>b.disponible)?.id||null);
      if(!options.sucursales.some(b=>b.disponible))this.checkoutError.set('Ninguna sucursal tiene todas las cantidades de este carrito. Ajusta las prendas o cantidades para continuar.');
    },error:()=>{this.checkingAvailability.set(false);this.checkoutError.set('No pudimos comprobar la disponibilidad. Recupera conexión y vuelve a intentarlo.');}});
    this.loadAddresses();
  }

  backToCart(): void {
    this.step.set('CART');
  }

  shippingCost(): number {
    return this.checkoutForm.get('tipo_entrega')?.value === 'DELIVERY' ? (this.deliveryFee()??0) : 0.0;
  }

  grandTotal(): number {
    return Math.max(0, this.cart.subtotal() - this.cart.discountAmount()) + this.shippingCost();
  }

  confirmOrder(): void {
    if(this.checkoutForm.get('tipo_entrega')?.value==='DELIVERY' && this.deliveryFee()===null){this.toast.show('No pudimos consultar la tarifa de envío. Reabre el carrito para reintentar.','error');return;}
    if (this.processing() || this.checkingAvailability() || this.checkoutError()) return;
    if (
      this.checkoutForm.controls.tipo_entrega.value === 'RECOJO' &&
      !this.checkoutForm.controls.sucursal_id.value
    ) {
      this.toast.show('Elige la sucursal donde recogerás tu compra.', 'info');
      return;
    }
    this.processing.set(true);

    const formVal = this.checkoutForm.getRawValue();
    const isDelivery = formVal.tipo_entrega === 'DELIVERY';

    // If delivery and need new address creation
    if (isDelivery && (!this.selectedAddressId() || this.showNewAddressForm())) {
      if (!formVal.direccion.trim()) {
        this.toast.show('Por favor ingresa la dirección de entrega', 'error');
        this.processing.set(false);
        return;
      }
      this.accountApi
        .createAddress({
          alias: 'Mi Domicilio',
          departamento: formVal.departamento,
          ciudad: formVal.ciudad,
          zona: formVal.zona,
          direccion: formVal.direccion,
          telefono_contacto: formVal.telefono_contacto || this.auth.user()?.telefono || '',
          es_principal: true,
        })
        .subscribe({
          next: (newAddr) => {
            this.selectedAddressId.set(newAddr.id);
            this.executeCheckout(newAddr.id);
          },
          error: (err) => {
            this.processing.set(false);
            this.toast.show(err?.error?.detail || 'Error al guardar la dirección', 'error');
          },
        });
    } else {
      this.executeCheckout(isDelivery ? this.selectedAddressId() : null);
    }
  }

  private executeCheckout(addressId: number | null): void {
    const formVal = this.checkoutForm.getRawValue();
    this.lastPaymentMethod.set(formVal.metodo_pago);
    this.commerceApi
      .checkout({
        sucursal_id: formVal.tipo_entrega === 'RECOJO' ? formVal.sucursal_id : null,
        canal: 'WEB',
        tipo_entrega: formVal.tipo_entrega,
        direccion_id: addressId,
        costo_envio: this.shippingCost(),
        observacion: formVal.observacion || null,
        codigo_promocion: this.cart.appliedPromo()?.codigo || null,
      })
      .subscribe({
        next: (order) => {
          this.lastOrder.set(order);
          this.processing.set(false);
          this.step.set('SUCCESS');
          this.cart.loadCart();
          this.toast.show('Pedido preparado. Autoriza el pago con Stripe.', 'info');
        },
        error: (err) => {
          this.processing.set(false);
          const detail=err?.error?.detail;const message=typeof detail==='string'?detail:detail?.message||'No se pudo completar la compra. Revisa el carrito.';
          this.checkoutError.set(message);this.toast.show(message,'error');
        },
      });
  }

  viewMyOrders(): void {
    this.cart.close();
    this.router.navigate(['/orders']);
  }

  openReceiptModal(): void {
    this.showReceiptModal.set(true);
  }

  closeReceiptModal(): void {
    this.showReceiptModal.set(false);
  }
}
