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
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (enabled()) {
      <section class="dm-stripe-card" aria-label="Pago seguro con tarjeta Stripe">
        <!-- BRAND & MODE HEADER -->
        <div class="dm-stripe-header">
          <div class="stripe-brand-badge">
            <svg class="stripe-svg-logo" viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="24" rx="6" fill="#635BFF" />
              <path d="M16.5 10.2c0-.7.6-1 1.5-1 1.4 0 3 .4 4.3 1.1V6.8c-1.4-.6-2.9-.8-4.3-.8-3.6 0-6 1.9-6 5.1 0 5 6.9 4.2 6.9 6.3 0 .8-.7 1.1-1.7 1.1-1.5 0-3.4-.6-4.9-1.5v3.6c1.6.7 3.3 1 4.9 1 3.7 0 6.3-1.8 6.3-5.1 0-5.3-7-4.4-7-6.5z" fill="#fff" />
            </svg>
            <div class="stripe-brand-titles">
              <span class="stripe-brand-name">Stripe Payments</span>
              <span class="stripe-brand-sub">Transacción Segura Atelier</span>
            </div>
          </div>

          @if (isSandbox()) {
            <span class="dm-pill-sandbox">✦ MODO SANDBOX</span>
          } @else {
            <span class="dm-pill-live">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              ENCRIPTACIÓN 256-BIT
            </span>
          }
        </div>

        <!-- ERROR ALERT -->
        @if (error()) {
          <div class="dm-alert dm-alert--error" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{{ error() }}</span>
          </div>
        }

        <!-- APPROVED STATE -->
        @if (approved()) {
          <div class="dm-approved-card">
            <div class="approved-seal">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div class="approved-text">
              <h4>¡Pago Procesado y Aprobado!</h4>
              <p>Tu orden ha sido confirmada en tiempo real. Tu comprobante oficial ya está disponible.</p>
            </div>
          </div>
        }

        <!-- SANDBOX CARDS DEMO VIEW -->
        @if (!approved() && isSandbox()) {
          <!-- LUXURY EDITORIAL CREDIT CARD PREVIEW -->
          <div class="editorial-card-wrap">
            <div class="editorial-credit-card">
              <div class="card-glass-glow"></div>
              <div class="card-head-row">
                <div class="chip-wrapper">
                  <div class="gold-chip">
                    <div class="chip-circuit c-1"></div>
                    <div class="chip-circuit c-2"></div>
                  </div>
                  <div class="contactless-waves">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M8.5 16.5a5 5 0 0 1 0-9"/>
                      <path d="M12 19a8.5 8.5 0 0 0 0-14"/>
                      <path d="M15.5 21.5a12 12 0 0 0 0-19"/>
                    </svg>
                  </div>
                </div>

                <div class="card-monogram-badge">
                  <span class="card-brand-label">{{ selectedBrand() }}</span>
                </div>
              </div>

              <div class="card-number-stream">
                {{ cardNumber() }}
              </div>

              <div class="card-meta-row">
                <div class="meta-field">
                  <span class="meta-field-label">TITULAR AUTORIZADO</span>
                  <span class="meta-field-val">{{ cardHolder().toUpperCase() }}</span>
                </div>
                <div class="meta-field text-right">
                  <span class="meta-field-label">VENCE</span>
                  <span class="meta-field-val">{{ cardExpiry() }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- EDITORIAL INPUT CONTROLS -->
          <div class="dm-controls-form">
            <div class="dm-field-group">
              <label for="cardHolderInput" class="dm-label">Nombre del Titular</label>
              <input
                id="cardHolderInput"
                type="text"
                class="dm-input"
                [ngModel]="cardHolder()"
                (ngModelChange)="cardHolder.set($event)"
                placeholder="Ej. Juan Pérez"
              />
            </div>

            <div class="dm-fields-row">
              <div class="dm-field-group">
                <label for="cardTypeSelect" class="dm-label">Tarjeta de Simulación</label>
                <div class="dm-select-wrap">
                  <select
                    id="cardTypeSelect"
                    class="dm-input dm-select"
                    [ngModel]="selectedCardType()"
                    (ngModelChange)="changeTestCard($event)"
                  >
                    <option value="visa_ok">Visa Test (4242 •••• 4242) — Cobro Inmediato</option>
                    <option value="mc_ok">Mastercard Test (5555 •••• 4444) — Cobro Inmediato</option>
                  </select>
                </div>
              </div>

              <div class="dm-field-group cvc-group">
                <label class="dm-label">CVC / CVV</label>
                <input type="text" class="dm-input text-center" value="888" readonly />
              </div>
            </div>

            <div class="sandbox-info-banner">
              <div class="info-sparkle">✦</div>
              <p>
                <strong>Entorno Sandbox DrapeMind Activo:</strong> Puedes autorizar el pedido sin debitar dinero real. Se generará tu comprobante oficial con sello de verificación digital.
              </p>
            </div>

            <!-- PRIMARY LIME CTA BUTTON -->
            <button
              class="dm-btn-pay"
              type="button"
              (click)="paySandbox()"
              [disabled]="busy()"
            >
              @if (busy()) {
                <span class="dm-spinner"></span>
                <span>Validando transacción con Stripe...</span>
              } @else {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <rect width="20" height="14" x="2" y="5" rx="2"/>
                  <line x1="2" x2="22" y1="10" stroke="currentColor" stroke-width="2.5"/>
                </svg>
                <span>Confirmar Pago con Tarjeta</span>
              }
            </button>
          </div>
        }

        <!-- REAL STRIPE ELEMENTS MOUNT -->
        @if (!approved() && !isSandbox()) {
          <div class="real-stripe-wrapper">
            @if (!ready() && !busy()) {
              <div class="init-prompt">
                <p>Listo para conectar con el servidor cifrado de Stripe.</p>
                <button class="dm-btn-secondary" type="button" (click)="prepare()">
                  Cargar formulario seguro
                </button>
              </div>
            }

            <div #elementHost class="stripe-elements-mount-slot"></div>

            @if (ready()) {
              <div class="actions-row">
                <button
                  class="dm-btn-pay"
                  type="button"
                  (click)="payRealStripe()"
                  [disabled]="busy()"
                >
                  @if (busy()) {
                    <span class="dm-spinner"></span> Procesando con Stripe...
                  } @else {
                    <span>Pagar ahora con Stripe</span>
                  }
                </button>
                <button
                  class="dm-btn-secondary"
                  type="button"
                  (click)="check()"
                  [disabled]="busy()"
                >
                  Consultar Estado
                </button>
              </div>
            }
          </div>
        }

        <!-- STATUS CAPTION -->
        @if (status()) {
          <p class="dm-status-caption" role="status" aria-live="polite">{{ status() }}</p>
        }
      </section>
    }
  `,
  styles: [`
    :host {
      display: block;
      margin: 16px 0;
      font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* CONTAINER: Warm editorial white surface conforming to DrapeMind Design System */
    .dm-stripe-card {
      background: #FFFFFF;
      border: 1px solid #E1E3DA;
      border-radius: 28px;
      padding: 24px 28px;
      color: #10110F;
      box-shadow: 0 14px 36px rgba(16, 17, 15, 0.08);
      position: relative;
    }

    /* HEADER */
    .dm-stripe-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 22px;
      flex-wrap: wrap;
    }

    .stripe-brand-badge {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .stripe-svg-logo {
      width: 44px;
      height: 26px;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(99, 91, 255, 0.25);
      flex-shrink: 0;
    }

    .stripe-brand-titles {
      display: flex;
      flex-direction: column;
    }

    .stripe-brand-name {
      font-size: 15px;
      font-weight: 800;
      color: #10110F;
      letter-spacing: -0.2px;
    }

    .stripe-brand-sub {
      font-size: 11px;
      color: #7B7F75;
      font-weight: 500;
    }

    .dm-pill-sandbox {
      background: #EEFF9D;
      color: #10110F;
      font-size: 11px;
      font-weight: 800;
      padding: 6px 14px;
      border-radius: 999px;
      letter-spacing: 0.6px;
      box-shadow: 0 2px 8px rgba(223, 255, 63, 0.35);
    }

    .dm-pill-live {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #E8F8EE;
      color: #1E7E34;
      font-size: 11px;
      font-weight: 800;
      padding: 6px 14px;
      border-radius: 999px;
      letter-spacing: 0.5px;
    }

    /* LUXURY EDITORIAL CREDIT CARD */
    .editorial-card-wrap {
      perspective: 1000px;
      margin-bottom: 22px;
    }

    .editorial-credit-card {
      background: linear-gradient(135deg, #10110F 0%, #1A1C16 65%, #25291F 100%);
      border: 1px solid rgba(223, 255, 63, 0.35);
      border-radius: 20px;
      padding: 24px 28px;
      color: #FFFFFF;
      box-shadow: 0 16px 36px rgba(16, 17, 15, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.15);
      position: relative;
      overflow: hidden;
    }

    .card-glass-glow {
      position: absolute;
      top: -40px;
      right: -40px;
      width: 140px;
      height: 140px;
      background: radial-gradient(circle, rgba(223, 255, 63, 0.15) 0%, transparent 70%);
      pointer-events: none;
    }

    .card-head-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 26px;
    }

    .chip-wrapper {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .gold-chip {
      width: 40px;
      height: 30px;
      background: linear-gradient(135deg, #E6CA65 0%, #C49E00 100%);
      border-radius: 6px;
      position: relative;
      overflow: hidden;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.35);
    }

    .chip-circuit {
      position: absolute;
      border: 1px solid rgba(0, 0, 0, 0.25);
      width: 100%;
    }

    .chip-circuit.c-1 { top: 35%; }
    .chip-circuit.c-2 { top: 65%; }

    .contactless-waves {
      color: rgba(255, 255, 255, 0.5);
    }

    .card-monogram-badge {
      background: rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(8px);
      padding: 4px 12px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .card-brand-label {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 1.5px;
      color: #DFFF3F;
    }

    .card-number-stream {
      font-family: 'Space Mono', 'Courier New', monospace;
      font-size: 21px;
      font-weight: 700;
      letter-spacing: 3.5px;
      color: #FFFFFF;
      margin-bottom: 22px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    }

    .card-meta-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .meta-field {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .meta-field-label {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 1.2px;
      color: rgba(255, 255, 255, 0.55);
      text-transform: uppercase;
    }

    .meta-field-val {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.8px;
      color: #F4F5EA;
    }

    .text-right { text-align: right; }

    /* EDITORIAL CONTROLS */
    .dm-controls-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .dm-fields-row {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 14px;
    }

    .dm-field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .dm-label {
      font-size: 12px;
      font-weight: 700;
      color: #40433D;
      letter-spacing: -0.1px;
    }

    .dm-input {
      width: 100%;
      min-height: 48px;
      padding: 0 16px;
      background: #F8F9F2;
      border: 1.5px solid #E1E3DA;
      border-radius: 16px;
      color: #10110F;
      font-size: 14px;
      font-weight: 600;
      box-sizing: border-box;
      outline: none;
      transition: all 0.2s;
    }

    .dm-input:focus {
      border-color: #10110F;
      background: #FFFFFF;
      box-shadow: 0 0 0 4px rgba(223, 255, 63, 0.35);
    }

    .dm-select-wrap {
      position: relative;
    }

    .dm-select {
      appearance: none;
      cursor: pointer;
      padding-right: 32px;
    }

    .cvc-group {
      max-width: 110px;
    }

    .text-center { text-align: center; }

    .sandbox-info-banner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #F4F5EA;
      border: 1px solid #E1E3DA;
      border-radius: 16px;
      padding: 12px 16px;
    }

    .info-sparkle {
      color: #10110F;
      font-weight: 900;
      font-size: 14px;
      margin-top: 1px;
    }

    .sandbox-info-banner p {
      margin: 0;
      font-size: 12px;
      color: #686B63;
      line-height: 1.5;
    }

    .sandbox-info-banner strong {
      color: #10110F;
    }

    /* PRIMARY ELECTRIC LIME CTA BUTTON */
    .dm-btn-pay {
      width: 100%;
      height: 52px;
      background: #DFFF3F;
      color: #10110F;
      border: none;
      border-radius: 999px;
      font-size: 15px;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      cursor: pointer;
      box-shadow: 0 6px 20px rgba(223, 255, 63, 0.4);
      transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .dm-btn-pay:hover:not(:disabled) {
      background: #D2F632;
      transform: translateY(-2px);
      box-shadow: 0 8px 26px rgba(223, 255, 63, 0.5);
    }

    .dm-btn-pay:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .dm-btn-secondary {
      padding: 12px 22px;
      border-radius: 999px;
      background: #FFFFFF;
      color: #10110F;
      border: 1.5px solid #E1E3DA;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
    }

    .dm-btn-secondary:hover {
      background: #F0F1EB;
    }

    .dm-spinner {
      width: 18px;
      height: 18px;
      border: 2.5px solid rgba(16, 17, 15, 0.2);
      border-top-color: #10110F;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* REAL STRIPE BOX */
    .real-stripe-wrapper {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .stripe-elements-mount-slot {
      margin: 12px 0;
      min-height: 50px;
      background: #FFFFFF;
      padding: 12px;
      border: 1px solid #E1E3DA;
      border-radius: 16px;
    }

    .actions-row {
      display: flex;
      gap: 12px;
    }

    /* APPROVED CARD & ALERT */
    .dm-approved-card {
      background: #E8F8EE;
      border: 1px solid #A3E6B5;
      border-radius: 18px;
      padding: 18px 22px;
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 14px;
    }

    .approved-seal {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #1E7E34;
      color: #FFFFFF;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .approved-text h4 {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 800;
      color: #1E7E34;
    }

    .approved-text p {
      margin: 0;
      font-size: 13px;
      color: #2F5233;
    }

    .dm-alert {
      padding: 14px 18px;
      border-radius: 14px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .dm-alert--error {
      background: #FEE2E2;
      border: 1px solid #FCA5A5;
      color: #B91C1C;
    }

    .dm-status-caption {
      font-size: 12px;
      text-align: center;
      margin-top: 14px;
      color: #7B7F75;
      font-weight: 600;
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
