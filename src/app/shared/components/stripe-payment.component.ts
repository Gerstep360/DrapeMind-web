import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, input, output, signal } from '@angular/core';
import { firstValueFrom, from, timeout } from 'rxjs';
import { loadStripe } from '@stripe/stripe-js/pure';
import type { Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js';
import { StoreApiService } from '../../core/store-api.service';
import { Payment } from '../../core/models';

@Component({
  selector: 'app-stripe-payment',
  template: `
    @if (enabled()) {
      <section aria-label="Pago seguro con tarjeta">
        <h3>Paga tus prendas con tarjeta</h3>
        <p>Los datos de tu tarjeta se envían a Stripe. DrapeMind confirma el pago cuando recibe su notificación.</p>
        @if (!ready() && !approved()) {
          <button type="button" (click)="prepare()" [disabled]="busy()">{{ busy() ? 'Preparando pago…' : 'Pagar con tarjeta' }}</button>
        }
        <div #elementHost></div>
        @if (ready() && !approved()) {
          <button type="button" (click)="pay()" [disabled]="busy()">{{ busy() ? 'Comprobando pago…' : 'Confirmar pago con Stripe' }}</button>
          <button class="secondary" type="button" (click)="check()" [disabled]="busy()">Consultar estado</button>
        }
        <p role="status" aria-live="polite">{{ status() }}</p>
        @if (error()) { <p role="alert">{{ error() }}</p> }
      </section>
    }
  `,
  styles: [`
    :host { display:block; } section { padding:20px; border:1px solid var(--dm-border, #dedfd4); border-radius:24px; background:var(--dm-surface, #fff); }
    h3 { margin:0 0 8px; font:inherit; font-weight:700; color:#10110f; }
    p { font-size:13px; line-height:1.55; color:#4c5048; } [role=alert] { color:#9b2424; }
    button { margin:12px 8px 0 0; padding:12px 18px; border:1px solid transparent; border-radius:24px; background:#dfff3f; color:#10110f; font:inherit; font-weight:600; cursor:pointer; }
    button.secondary { background:#f4f5ea; border-color:#dedfd4; } button:disabled { opacity:.6; cursor:wait; }
    button:focus-visible { outline:2px solid #10110f; outline-offset:3px; }
  `],
})
export class StripePaymentComponent implements OnInit, OnDestroy {
  readonly orderId = input.required<number>();
  readonly paid = output<Payment>();
  private readonly api = inject(StoreApiService);
  @ViewChild('elementHost') private host?: ElementRef<HTMLDivElement>;
  readonly enabled = signal(false);
  readonly ready = signal(false);
  readonly busy = signal(false);
  readonly approved = signal(false);
  readonly error = signal('');
  readonly status = signal('');
  private stripe: Stripe | null = null;
  private elements?: StripeElements;
  private element?: StripePaymentElement;
  private paymentId?: number;
  private destroyed = false;
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.api.paymentConfiguration().subscribe({ next: c => { if (!this.destroyed) this.enabled.set(c.provider === 'stripe'); }, error: () => {} });
  }
  async prepare(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      const intent = await firstValueFrom(this.api.stripeIntent(this.orderId()).pipe(timeout(25000)));
      if (this.destroyed) return;
      this.paymentId = intent.payment_id;
      this.stripe = await firstValueFrom(from(loadStripe(intent.publishable_key)).pipe(timeout(20000)));
      if (this.destroyed) return;
      if (!this.stripe || !this.host || !intent.client_secret) throw new Error();
      this.elements = this.stripe.elements({clientSecret: intent.client_secret,
        appearance: {theme:'stripe', variables:{colorPrimary:'#10110f', borderRadius:'16px'}}});
      this.element = this.elements.create('payment');
      this.element.mount(this.host.nativeElement);
      this.ready.set(true);
    } catch (e: any) { if (!this.destroyed) this.error.set(e?.error?.detail || 'No se pudo preparar Stripe. Reintenta este pedido.'); }
    finally { if (!this.destroyed) this.busy.set(false); }
  }
  async pay(): Promise<void> {
    if (this.busy() || !this.stripe || !this.elements) return;
    this.busy.set(true); this.error.set('');
    try {
      const result = await this.stripe.confirmPayment({elements:this.elements,
        confirmParams:{return_url: new URL('orders', document.baseURI).href}, redirect:'if_required'});
      if (this.destroyed) return;
      if (result.error) { this.error.set(result.error.message || 'No se pudo confirmar la tarjeta.'); return; }
      this.status.set('Esperando confirmación del servidor…');
      await this.poll(0);
    } catch { if (!this.destroyed) this.error.set('No se pudo consultar el pago. No repitas el pedido: consulta su estado.'); }
    finally { if (!this.destroyed) this.busy.set(false); }
  }
  async check(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try { await this.poll(9); }
    catch { this.error.set('No se pudo consultar el estado. Reintenta.'); }
    finally { if (!this.destroyed) this.busy.set(false); }
  }
  private async poll(attempt: number): Promise<void> {
    if (this.destroyed || !this.paymentId) return;
    const payment = await firstValueFrom(this.api.payment(this.paymentId).pipe(timeout(10000)));
    if (this.destroyed) return;
    this.status.set(payment.estado === 'APROBADO' ? 'Pago confirmado por el servidor.' : `Estado del pago: ${payment.estado}. Puedes consultarlo desde tus pedidos.`);
    if (payment.estado === 'APROBADO') { this.approved.set(true); this.element?.unmount(); this.paid.emit(payment); }
    else if (payment.estado === 'PENDIENTE' && attempt < 9) {
      this.timer = setTimeout(() => { void this.poll(attempt + 1).catch(() => {
        if (!this.destroyed) this.status.set('Confirmación pendiente. Consulta el estado en tus pedidos.');
      }); }, 2000);
    }
  }
  ngOnDestroy(): void { this.destroyed = true; clearTimeout(this.timer); this.element?.destroy(); }
}
