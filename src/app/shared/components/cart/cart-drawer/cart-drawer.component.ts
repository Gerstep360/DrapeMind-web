import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { AuthService } from '@core/auth.service';
import { CartService } from '@core/cart.service';
import { Address, Order, Payment } from '@core/models';
import { AccountApiService } from '@core/api/account-api.service';
import { CommerceApiService } from '@core/api/commerce-api.service';
import { ToastService } from '@core/toast.service';
import { RuntimeConfigService } from '@core/runtime-config.service';
import {
  garmentPresentationType,
  hasUsableGarmentImage,
} from '@shared/presentation/garment-presentation';
import { ReceiptModalComponent } from '@shared/components/receipt-modal/receipt-modal.component';
import { StripePaymentComponent } from '@shared/components/stripe-payment.component';
import { CartDrawerStep } from './cart-drawer.models';

@Component({
  selector: 'app-cart-drawer',
  imports: [ReactiveFormsModule, DecimalPipe, ReceiptModalComponent, StripePaymentComponent],
  templateUrl: './cart-drawer.component.html',
  styleUrl: './cart-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartDrawerComponent {
  stripePaid(payment: Payment): void {
    this.lastPayment.set(payment);
    const order = this.lastOrder();
    if (order && payment.estado === 'APROBADO') this.lastOrder.set({ ...order, estado: 'PAGADO' });
  }
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);
  readonly runtime = inject(RuntimeConfigService);
  private readonly commerceApi = inject(CommerceApiService);
  private readonly accountApi = inject(AccountApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly step = signal<CartDrawerStep>('CART');
  readonly processing = signal<boolean>(false);
  readonly addresses = signal<Address[]>([]);
  readonly selectedAddressId = signal<number | null>(null);
  readonly showNewAddressForm = signal<boolean>(false);

  // Success state data
  readonly lastOrder = signal<Order | null>(null);
  readonly lastPayment = signal<Payment | null>(null);
  readonly lastPaymentMethod = signal<string>('QR');
  readonly payingMock = signal<boolean>(false);
  readonly showReceiptModal = signal<boolean>(false);

  readonly checkoutForm = this.fb.nonNullable.group({
    tipo_entrega: ['RECOJO' as 'DELIVERY' | 'RECOJO' | 'TIENDA', Validators.required],
    metodo_pago: ['QR' as 'QR' | 'TARJETA' | 'EFECTIVO' | 'TRANSFERENCIA', Validators.required],
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

  constructor() {
    effect(() => {
      if (this.cart.isOpen()) {
        this.loadAddresses();
      } else {
        // Reset to cart view when drawer is closed
        setTimeout(() => this.step.set('CART'), 300);
      }
    });
  }

  analyzeWithAi(): void {
    this.cart.close();
    this.router.navigate(['/ai-studio'], {
      queryParams: {
        autoQuery: 'Mira mi carrito y dime que puedo quitar o que puedo combinar en mi eleccion',
      },
    });
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
  }

  backToCart(): void {
    this.step.set('CART');
  }

  shippingCost(): number {
    return this.checkoutForm.get('tipo_entrega')?.value === 'DELIVERY' ? 15.0 : 0.0;
  }

  grandTotal(): number {
    return this.cart.subtotal() + this.shippingCost();
  }

  confirmOrder(): void {
    if (this.processing()) return;
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
        tipo_entrega: formVal.tipo_entrega,
        direccion_id: addressId,
        costo_envio: this.shippingCost(),
        observacion: formVal.observacion || null,
      })
      .subscribe({
        next: (order) => {
          this.lastOrder.set(order);
          if (formVal.metodo_pago === 'TARJETA') {
            this.processing.set(false);
            this.step.set('SUCCESS');
            this.cart.loadCart();
            this.toast.show('¡Pedido generado exitosamente!', 'success');
          } else {
            this.commerceApi
              .initiatePayment({
                pedido_id: order.id,
                metodo: formVal.metodo_pago,
              })
              .subscribe({
                next: (payment) => {
                  this.lastPayment.set(payment);
                  this.processing.set(false);
                  this.step.set('SUCCESS');
                  this.cart.loadCart();
                  this.toast.show('¡Pedido generado exitosamente!', 'success');
                },
                error: () => {
                  this.processing.set(false);
                  this.step.set('SUCCESS');
                  this.cart.loadCart();
                },
              });
          }
        },
        error: (err) => {
          this.processing.set(false);
          this.toast.show(err?.error?.detail || 'No se pudo completar el checkout', 'error');
        },
      });
  }

  confirmMockPayment(): void {
    const payment = this.lastPayment();
    if (!payment || this.payingMock()) return;
    this.payingMock.set(true);

    this.commerceApi.mockConfirmPayment(payment.id).subscribe({
      next: (confirmedPayment) => {
        this.lastPayment.set(confirmedPayment);
        if (this.lastOrder()) {
          this.lastOrder.set({ ...this.lastOrder()!, estado: 'PAGADO' });
        }
        this.payingMock.set(false);
        this.toast.show('¡Pago aprobado y confirmado en tiempo real!', 'success');
      },
      error: (err) => {
        this.payingMock.set(false);
        this.toast.show(err?.error?.detail || 'No se pudo confirmar el pago', 'error');
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
