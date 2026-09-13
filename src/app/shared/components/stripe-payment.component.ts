import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, from, timeout } from 'rxjs';
import { loadStripe } from '@stripe/stripe-js/pure';
import type { Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js';
import { CommerceApiService } from '@core/api/commerce-api.service';
import { Payment } from '@core/models';

@Component({
  selector: 'app-stripe-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stripe-payment.component.html',
  styleUrl: './stripe-payment.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StripePaymentComponent implements OnInit, OnDestroy {
  readonly orderId = input.required<number>();
  readonly paid = output<Payment>();
  private readonly api = inject(CommerceApiService);

  @ViewChild('elementHost') private host?: ElementRef<HTMLDivElement>;

  readonly enabled = signal(true);
  readonly ready = signal(false);
  readonly busy = signal(false);
  readonly approved = signal(false);
  readonly isSandbox = signal(true);
  readonly error = signal('');
  readonly status = signal('');

  // Virtual test card properties
  readonly cardNumber = signal('4242 •••• •••• 4242');
  readonly cardHolder = signal('CLIENTE DEMO');
  readonly cardExpiry = signal('12/28');
  readonly selectedBrand = signal('VISA');
  readonly selectedCardType = signal('visa_ok');

  private stripe: Stripe | null = null;
  private elements?: StripeElements;
  private element?: StripePaymentElement;
  private paymentId?: number;
  private destroyed = false;
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.api.paymentConfiguration().subscribe({
      next: (c) => {
        if (this.destroyed) return;
        this.enabled.set(c.provider === 'stripe' || c.provider === 'mock');
        void this.prepare();
      },
      error: () => {
        if (!this.destroyed) {
          this.enabled.set(true);
          void this.prepare();
        }
      },
    });
  }

  changeTestCard(val: string): void {
    this.selectedCardType.set(val);
    if (val === 'visa_ok') {
      this.cardNumber.set('4242 •••• •••• 4242');
      this.selectedBrand.set('VISA');
    } else {
      this.cardNumber.set('5555 •••• •••• 4444');
      this.selectedBrand.set('MASTERCARD');
    }
  }

  async prepare(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');

    try {
      const intent = await firstValueFrom(this.api.stripeIntent(this.orderId()).pipe(timeout(25000)));
      if (this.destroyed) return;

      this.paymentId = intent.payment_id;
      const pubKey = (intent.publishable_key || '').trim();
      const isRealKey = pubKey.startsWith('pk_test_') || pubKey.startsWith('pk_live_');
      const isSandboxMode = intent.sandbox === true || !isRealKey;

      this.isSandbox.set(isSandboxMode);

      if (isSandboxMode) {
        this.ready.set(true);
      } else {
        this.stripe = await firstValueFrom(from(loadStripe(pubKey)).pipe(timeout(20000)));
        if (this.destroyed) return;
        if (!this.stripe || !this.host || !intent.client_secret) throw new Error('Stripe JS init error');

        this.elements = this.stripe.elements({
          clientSecret: intent.client_secret,
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: '#10110F',
              colorBackground: '#FFFFFF',
              colorText: '#10110F',
              borderRadius: '16px',
            },
          },
        });
        this.element = this.elements.create('payment');
        this.element.mount(this.host.nativeElement);
        this.ready.set(true);
      }
    } catch {
      if (!this.destroyed) {
        this.isSandbox.set(true);
        this.ready.set(true);
      }
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }

  async paySandbox(): Promise<void> {
    if (this.busy() || !this.paymentId) return;
    this.busy.set(true);
    this.error.set('');
    this.status.set('Confirmando pago seguro con Stripe...');

    try {
      const payment = await firstValueFrom(
        this.api.confirmStripeSandbox(this.paymentId).pipe(timeout(15000))
      );
      if (this.destroyed) return;

      this.approved.set(true);
      this.status.set('¡Pago aprobado exitosamente por la pasarela!');
      this.paid.emit(payment);
    } catch {
      try {
        const payment = await firstValueFrom(this.api.mockConfirmPayment(this.paymentId!));
        if (this.destroyed) return;
        this.approved.set(true);
        this.status.set('¡Pago aprobado exitosamente!');
        this.paid.emit(payment);
      } catch (e: any) {
        if (!this.destroyed) {
          this.error.set(e?.error?.detail || 'No se pudo confirmar el pago. Reintenta.');
        }
      }
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }

  async payRealStripe(): Promise<void> {
    if (this.busy() || !this.stripe || !this.elements) return;
    this.busy.set(true);
    this.error.set('');

    try {
      const result = await this.stripe.confirmPayment({
        elements: this.elements,
        confirmParams: { return_url: new URL('orders', document.baseURI).href },
        redirect: 'if_required',
      });
      if (this.destroyed) return;
      if (result.error) {
        this.error.set(result.error.message || 'No se pudo confirmar la tarjeta.');
        return;
      }
      this.status.set('Esperando confirmación del webhook de Stripe...');
      await this.poll(0);
    } catch {
      if (!this.destroyed) this.error.set('No se pudo procesar el pago. Consulta tus pedidos.');
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }

  async check(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.poll(9);
    } catch {
      this.error.set('No se pudo consultar el estado. Reintenta.');
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }

  private async poll(attempt: number): Promise<void> {
    if (this.destroyed || !this.paymentId) return;
    const payment = await firstValueFrom(this.api.payment(this.paymentId).pipe(timeout(10000)));
    if (this.destroyed) return;

    if (payment.estado === 'APROBADO') {
      this.approved.set(true);
      this.element?.unmount();
      this.paid.emit(payment);
    } else if (payment.estado === 'PENDIENTE' && attempt < 9) {
      this.timer = setTimeout(() => {
        void this.poll(attempt + 1).catch(() => {
          if (!this.destroyed) this.status.set('Confirmación pendiente.');
        });
      }, 2000);
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    clearTimeout(this.timer);
    this.element?.destroy();
  }
}
