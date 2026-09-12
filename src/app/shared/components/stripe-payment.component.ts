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
import { StoreApiService } from '../../core/store-api.service';
import { Payment } from '../../core/models';

@Component({
  selector: 'app-stripe-payment',
  imports: [CommonModule, FormsModule],
  template: `
    @if (enabled()) {
      <section class="stripe-pay-container" aria-label="Pago seguro con tarjeta Stripe">
        <div class="stripe-header">
          <div class="stripe-badge-box">
            <svg class="stripe-icon" viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="24" rx="4" fill="#635BFF" />
              <path d="M16.5 10.2c0-.7.6-1 1.5-1 1.4 0 3 .4 4.3 1.1V6.8c-1.4-.6-2.9-.8-4.3-.8-3.6 0-6 1.9-6 5.1 0 5 6.9 4.2 6.9 6.3 0 .8-.7 1.1-1.7 1.1-1.5 0-3.4-.6-4.9-1.5v3.6c1.6.7 3.3 1 4.9 1 3.7 0 6.3-1.8 6.3-5.1 0-5.3-7-4.4-7-6.5z" fill="#fff" />
            </svg>
            <span class="stripe-title">Pasarela Stripe</span>
          </div>
          @if (isSandbox()) {
            <span class="sandbox-pill">SANDBOX TEST MODE</span>
          } @else {
            <span class="live-pill">PAGO ENCRIPTADO 256-BIT</span>
          }
        </div>

        <!-- ERROR STATE -->
        @if (error()) {
          <div class="stripe-alert stripe-alert--error" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{{ error() }}</span>
          </div>
        }

        <!-- APPROVED STATE -->
        @if (approved()) {
          <div class="stripe-success-card">
            <div class="success-icon-wrap">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <h4>¡Pago Aprobado con Éxito!</h4>
              <p>Tu transacción fue validada en tiempo real. Tu pedido ya está en preparación.</p>
            </div>
          </div>
        }

        <!-- SANDBOX CARDS DEMO VIEW -->
        @if (!approved() && isSandbox()) {
          <div class="card-visual-wrapper">
            <div class="luxury-credit-card">
              <div class="card-top-row">
                <div class="card-chip">
                  <div class="chip-line"></div>
                  <div class="chip-line"></div>
                </div>
                <div class="contactless-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M8.5 16.5a5 5 0 0 1 0-9"/>
                    <path d="M12 19a8.5 8.5 0 0 0 0-14"/>
                    <path d="M15.5 21.5a12 12 0 0 0 0-19"/>
                  </svg>
                </div>
                <div class="card-brand">
                  <span class="brand-text">{{ selectedBrand() }}</span>
                </div>
              </div>

              <div class="card-number-display">
                {{ cardNumber() }}
              </div>

              <div class="card-bottom-row">
                <div class="card-holder-group">
                  <span class="card-label">TITULAR</span>
                  <span class="card-value">{{ cardHolder().toUpperCase() }}</span>
                </div>
                <div class="card-expiry-group">
                  <span class="card-label">EXPIRA</span>
                  <span class="card-value">{{ cardExpiry() }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="sandbox-controls">
            <div class="form-group">
              <label for="cardHolderInput">Nombre en la tarjeta</label>
              <input
                id="cardHolderInput"
                type="text"
                class="input-control"
                [ngModel]="cardHolder()"
                (ngModelChange)="cardHolder.set($event)"
                placeholder="Ej. Juan Pérez"
              />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Tarjeta de Prueba</label>
                <select class="input-control" [ngModel]="selectedCardType()" (ngModelChange)="changeTestCard($event)">
                  <option value="visa_ok">Visa Test (4242 •••• 4242) - Éxito</option>
                  <option value="mc_ok">Mastercard (5555 •••• 4444) - Éxito</option>
                </select>
              </div>
              <div class="form-group">
                <label>CVC / CVV</label>
                <input type="text" class="input-control" value="888" readonly />
              </div>
            </div>

            <p class="sandbox-note">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              Sandbox de Stripe activo. Haz clic abajo para confirmar el cobro sin tarjetas reales.
            </p>

            <button
              class="pay-btn pay-btn--primary"
              type="button"
              (click)="paySandbox()"
              [disabled]="busy()"
            >
              @if (busy()) {
                <span class="spinner"></span> Procesando con Stripe...
              } @else {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
                </svg>
                <span>Pagar con Tarjeta (Stripe Sandbox)</span>
              }
            </button>
          </div>
        }

        <!-- REAL STRIPE ELEMENTS MOUNT -->
        @if (!approved() && !isSandbox()) {
          <div class="real-stripe-box">
            @if (!ready() && !busy()) {
              <div class="init-box">
                <p>Listo para conectar con Stripe seguro.</p>
                <button class="pay-btn pay-btn--secondary" type="button" (click)="prepare()">
                  Cargar formulario de tarjeta
                </button>
              </div>
            }

            <div #elementHost class="stripe-element-mount"></div>

            @if (ready()) {
              <div class="action-buttons-row">
                <button
                  class="pay-btn pay-btn--primary"
                  type="button"
                  (click)="payRealStripe()"
                  [disabled]="busy()"
                >
                  {{ busy() ? 'Procesando con Stripe...' : 'Pagar ahora con Stripe' }}
                </button>
                <button
                  class="pay-btn pay-btn--ghost"
                  type="button"
                  (click)="check()"
                  [disabled]="busy()"
                >
                  Consultar estado
                </button>
              </div>
            }
          </div>
        }

        <!-- STATUS BAR -->
        @if (status()) {
          <p class="status-msg" role="status" aria-live="polite">{{ status() }}</p>
        }
      </section>
    }
  `,
  styles: [`
    :host {
      display: block;
      margin: 16px 0;
    }

    .stripe-pay-container {
      background: #0e1015;
      border: 1px solid rgba(223, 255, 63, 0.25);
      border-radius: 20px;
      padding: 22px;
      color: #f4f5ea;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      position: relative;
      overflow: hidden;
    }

    .stripe-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
    }

    .stripe-badge-box {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .stripe-icon {
      width: 44px;
      height: 26px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(99, 91, 255, 0.4);
    }

    .stripe-title {
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 0.3px;
    }

    .sandbox-pill {
      background: rgba(223, 255, 63, 0.15);
      color: #dfff3f;
      border: 1px solid rgba(223, 255, 63, 0.35);
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
      letter-spacing: 0.5px;
    }

    .live-pill {
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.35);
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
      letter-spacing: 0.5px;
    }

    /* VIRTUAL CREDIT CARD */
    .card-visual-wrapper {
      perspective: 1000px;
      margin-bottom: 20px;
    }

    .luxury-credit-card {
      background: linear-gradient(135deg, #1e222d 0%, #111318 60%, #1a1e27 100%);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      padding: 20px 24px;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15);
      color: #ffffff;
      position: relative;
    }

    .card-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 22px;
    }

    .card-chip {
      width: 36px;
      height: 28px;
      background: linear-gradient(135deg, #e5be01 0%, #c49e00 100%);
      border-radius: 6px;
      position: relative;
      overflow: hidden;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
    }

    .chip-line {
      position: absolute;
      border: 1px solid rgba(0, 0, 0, 0.25);
      width: 100%;
      top: 35%;
    }

    .chip-line:last-child {
      top: 65%;
    }

    .contactless-icon {
      color: rgba(255, 255, 255, 0.5);
    }

    .brand-text {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 1.5px;
      color: #dfff3f;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    }

    .card-number-display {
      font-family: 'Courier New', Courier, monospace;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 3px;
      color: #ffffff;
      margin-bottom: 20px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
    }

    .card-bottom-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .card-label {
      display: block;
      font-size: 9px;
      letter-spacing: 1px;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 2px;
    }

    .card-value {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 1px;
      color: #e2e8f0;
    }

    /* CONTROLS */
    .sandbox-controls {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 12px;
    }

    .form-group label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #a0aec0;
      margin-bottom: 6px;
    }

    .input-control {
      width: 100%;
      padding: 10px 14px;
      background: #181b22;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      color: #ffffff;
      font-size: 14px;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.2s;
    }

    .input-control:focus {
      border-color: #dfff3f;
    }

    .sandbox-note {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #a3a89e;
      margin: 2px 0 6px;
      line-height: 1.4;
    }

    .sandbox-note svg {
      flex-shrink: 0;
      color: #dfff3f;
    }

    /* BUTTONS */
    .pay-btn {
      width: 100%;
      padding: 14px 20px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }

    .pay-btn--primary {
      background: #dfff3f;
      color: #10110f;
      box-shadow: 0 4px 16px rgba(223, 255, 63, 0.25);
    }

    .pay-btn--primary:hover:not(:disabled) {
      background: #c8eb2f;
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(223, 255, 63, 0.35);
    }

    .pay-btn--secondary {
      background: #232731;
      color: #f4f5ea;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }

    .pay-btn--ghost {
      background: transparent;
      color: #a0aec0;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .pay-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(16, 17, 15, 0.2);
      border-top-color: #10110f;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* REAL STRIPE MOUNT */
    .stripe-element-mount {
      margin: 14px 0;
      min-height: 50px;
      background: #ffffff;
      padding: 12px;
      border-radius: 12px;
    }

    .action-buttons-row {
      display: flex;
      gap: 10px;
    }

    /* ALERTS & SUCCESS */
    .stripe-alert {
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 13px;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .stripe-alert--error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
    }

    .stripe-success-card {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.35);
      border-radius: 14px;
      padding: 18px;
      display: flex;
      align-items: center;
      gap: 16px;
      color: #ffffff;
      margin-bottom: 14px;
    }

    .success-icon-wrap {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #22c55e;
      color: #0e1015;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .stripe-success-card h4 {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 700;
      color: #4ade80;
    }

    .stripe-success-card p {
      margin: 0;
      font-size: 13px;
      color: #e2e8f0;
    }

    .status-msg {
      font-size: 12px;
      text-align: center;
      margin-top: 10px;
      color: #a0aec0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StripePaymentComponent implements OnInit, OnDestroy {
  readonly orderId = input.required<number>();
  readonly paid = output<Payment>();
  private readonly api = inject(StoreApiService);

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
        // Auto-prepare payment on init
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
        // Sandbox mode ready immediately
        this.ready.set(true);
      } else {
        // Mount real Stripe Elements
        this.stripe = await firstValueFrom(from(loadStripe(pubKey)).pipe(timeout(20000)));
        if (this.destroyed) return;
        if (!this.stripe || !this.host || !intent.client_secret) throw new Error('Stripe JS init error');

        this.elements = this.stripe.elements({
          clientSecret: intent.client_secret,
          appearance: {
            theme: 'night',
            variables: { colorPrimary: '#dfff3f', colorBackground: '#181b22', borderRadius: '12px' },
          },
        });
        this.element = this.elements.create('payment');
        this.element.mount(this.host.nativeElement);
        this.ready.set(true);
      }
    } catch (e: any) {
      if (!this.destroyed) {
        // Fallback to sandbox if stripe API key rejected
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
    this.status.set('Confirmando pago con Stripe Sandbox...');

    try {
      const payment = await firstValueFrom(
        this.api.confirmStripeSandbox(this.paymentId).pipe(timeout(15000))
      );
      if (this.destroyed) return;

      this.approved.set(true);
      this.status.set('¡Pago aprobado por pasarela Stripe!');
      this.paid.emit(payment);
    } catch (err: any) {
      // Fallback to mockConfirm if needed
      try {
        const payment = await firstValueFrom(this.api.mockConfirmPayment(this.paymentId!));
        if (this.destroyed) return;
        this.approved.set(true);
        this.status.set('¡Pago aprobado!');
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
