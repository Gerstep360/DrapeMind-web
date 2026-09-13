import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError } from 'rxjs';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { StoreApiService } from '../../core/store-api.service';
import { ReceiptData } from '../../core/models';

/**
 * Tono visual de cada estado de pedido, mapeado a los tokens de estado
 * del design system (--dm-success / --dm-warning / --dm-danger).
 * Si el backend agrega un estado nuevo que no está en este mapa,
 * el pill cae a la variante "neutral" en vez de quedar sin estilo.
 */
type StatusTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

interface StatusMeta {
  label: string;
  tone: StatusTone;
}

const ESTADO_META: Record<string, StatusMeta> = {
  PENDIENTE_PAGO: { label: 'Pendiente de pago', tone: 'warning' },
  PAGADO: { label: 'Pago confirmado', tone: 'success' },
  CONFIRMADO: { label: 'Confirmado', tone: 'success' },
  EN_PREPARACION: { label: 'En preparación', tone: 'info' },
  ENVIADO: { label: 'Enviado', tone: 'info' },
  ENTREGADO: { label: 'Entregado', tone: 'success' },
  CANCELADO: { label: 'Cancelado', tone: 'danger' },
  DEVUELTO: { label: 'Devuelto', tone: 'danger' },
};

@Component({
  selector: 'app-receipt-view',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe],
  template: `
    <div class="receipt-public-page">
      <!-- NAVBAR FLOTANTE (spec §8) -->
      <nav class="dm-navbar">
        <div class="brand-monogram" aria-hidden="true">DM</div>
        <div class="brand-text-col">
          <span class="brand-name">DrapeMind Atelier</span>
          <span class="brand-sub">Comprobante digital de tu compra</span>
        </div>
        <a routerLink="/" class="dm-btn dm-btn--primary dm-store-btn">
          Explorar colección
          <span aria-hidden="true">→</span>
        </a>
      </nav>

      <main class="page-container">
        @if (loading()) {
          <!-- Skeleton en vez de spinner gigante (spec §29) -->
          <div class="skeleton-wrap" role="status" aria-live="polite">
            <span class="sr-only">Cargando tu comprobante…</span>
            <div class="skeleton-hero">
              <div class="dm-skeleton skeleton-pill" aria-hidden="true"></div>
              <div class="dm-skeleton skeleton-title" aria-hidden="true"></div>
              <div class="dm-skeleton skeleton-line" aria-hidden="true"></div>
            </div>
            <div class="skeleton-card" aria-hidden="true">
              <div class="dm-skeleton skeleton-row skeleton-row--wide"></div>
              <div class="skeleton-grid">
                <div class="dm-skeleton skeleton-block"></div>
                <div class="dm-skeleton skeleton-block"></div>
                <div class="dm-skeleton skeleton-block"></div>
                <div class="dm-skeleton skeleton-block"></div>
              </div>
              <div class="dm-skeleton skeleton-row"></div>
              <div class="dm-skeleton skeleton-row"></div>
              <div class="dm-skeleton skeleton-row skeleton-row--short"></div>
            </div>
          </div>
        } @else if (error()) {
          <div class="error-card">
            <div class="error-icon" aria-hidden="true">✕</div>
            <h2>Comprobante no disponible</h2>
            <p>{{ error() }}</p>
            <a routerLink="/" class="dm-btn dm-btn--primary">Volver a la tienda</a>
          </div>
        } @else {
          <!--
            "as" solo se permite en el @if primario de una cadena, nunca en
            un @else if (Angular lo rechaza con NG5002) — por eso el estado
            de éxito va en un @if anidado dentro de este @else en lugar de
            encadenarlo como "@else if (receipt(); as r)".
          -->
          @if (receipt(); as r) {
          <!-- HERO DE VERIFICACIÓN -->
          <header class="verification-hero">
            <div class="verified-badge">
              <span aria-hidden="true">✦</span>
              Verificado por DrapeMind
            </div>
            <h1 class="hero-title">Comprobante de compra</h1>
            <p class="hero-sub">
              Este comprobante confirma los datos de tu compra en <strong>DrapeMind Atelier</strong>.
              Puedes descargarlo, imprimirlo o guardar este enlace para consultarlo cuando lo necesites.
            </p>
            <div class="auth-meta-row">
              <span class="meta-tag">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                {{ r.order.created_at ? (r.order.created_at | date: 'dd/MM/yyyy HH:mm') : 'Fecha reciente' }}
              </span>
              <span class="meta-tag meta-tag--folio">
                #DM-ORD-{{ r.order.id.toString().padStart(5, '0') }}
              </span>
            </div>
          </header>

          <!-- ACCIONES -->
          <div class="actions-bar">
            <button
              type="button"
              class="dm-btn dm-btn--primary"
              (click)="downloadPdf()"
              [disabled]="generatingPdf()"
            >
              @if (generatingPdf()) {
                <span class="mini-spinner" aria-hidden="true"></span>
                Generando PDF…
              } @else {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Descargar PDF
              }
            </button>
            <button type="button" class="dm-btn dm-btn--secondary" (click)="print()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect width="12" height="8" x="6" y="14"/>
              </svg>
              Imprimir
            </button>
          </div>

          @if (pdfError()) {
            <p class="pdf-error-toast" role="alert">✕ {{ pdfError() }}</p>
          }

          <!-- COMPROBANTE IMPRIMIBLE / DESCARGABLE -->
          <article #printableCard class="receipt-card">
            <div class="card-header">
              <div class="card-brand">
                <div class="seal-box" aria-hidden="true">DM</div>
                <div>
                  <h2 class="card-title">DRAPEMIND ATELIER BOLIVIA</h2>
                  <p class="card-sub">Alta Costura Contemporánea · Confección de Autor</p>
                  <p class="card-legal">NIT: 7492019012 · Reg. Com. 49102-SCZ · Santa Cruz, Bolivia</p>
                </div>
              </div>
              <div class="status-box">
                <span class="status-pill status-pill--{{ statusMeta().tone }}">
                  <span aria-hidden="true">●</span>
                  {{ statusMeta().label }}
                </span>
                <span class="folio-code">#DM-ORD-{{ r.order.id.toString().padStart(5, '0') }}</span>
              </div>
            </div>

            <div class="hairline"></div>

            <div class="info-grid">
              <div class="info-cell">
                <span class="info-label">Cliente titular</span>
                <strong class="info-value">{{ r.cliente.nombre }}</strong>
                <span class="info-hint">{{ r.cliente.email || 'Email no registrado' }}</span>
              </div>
              <div class="info-cell">
                <span class="info-label">Sucursal / showroom</span>
                <strong class="info-value">{{ r.sucursal.nombre }}</strong>
                <span class="info-hint">{{ r.sucursal.direccion }}, {{ r.sucursal.ciudad }}</span>
              </div>
              <div class="info-cell">
                <span class="info-label">Fecha de emisión</span>
                <strong class="info-value">{{ r.order.created_at ? (r.order.created_at | date: 'dd/MM/yyyy HH:mm') : 'Fecha reciente' }}</strong>
                <span class="info-hint">Canal: {{ r.order.canal }} Online</span>
              </div>
              <div class="info-cell">
                <span class="info-label">Modalidad de entrega</span>
                <strong class="info-value">{{ r.order.tipo_entrega === 'RECOJO' ? 'Retiro en showroom' : 'Envío express a domicilio' }}</strong>
                <span class="info-hint">Código: {{ r.order.codigo_publico }}</span>
              </div>
            </div>

            <div class="table-wrap">
              <table class="receipt-table">
                <thead>
                  <tr>
                    <th scope="col">Prenda / concepto</th>
                    <th scope="col">SKU</th>
                    <th scope="col">Variante</th>
                    <th scope="col" class="text-center">Cant</th>
                    <th scope="col" class="text-right">P. unit.</th>
                    <th scope="col" class="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of r.items; track item.id) {
                    <tr>
                      <td><strong>{{ item.nombre }}</strong></td>
                      <td><code class="sku-code">{{ item.sku }}</code></td>
                      <td><span class="variant-tag">{{ item.color }} · Talla {{ item.talla }}</span></td>
                      <td class="text-center">{{ item.cantidad }}</td>
                      <td class="text-right">Bs {{ item.precio_unitario | number: '1.2-2' }}</td>
                      <td class="text-right"><strong>Bs {{ item.subtotal | number: '1.2-2' }}</strong></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="totals-section">
              <div class="payment-info-box">
                <span class="info-label">Método de pago</span>
                <div class="pay-method-pill">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                    <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
                  </svg>
                  <span>{{ r.payments[0]?.metodo || 'Pago directo' }}</span>
                  <span class="pay-check">✓ Pago confirmado</span>
                </div>
                <p class="pay-ref">Ref: <code>{{ r.payments[0]?.referencia || r.order.codigo_publico }}</code></p>
                @if (r.order.observacion) {
                  <p class="order-notes">Nota: {{ r.order.observacion }}</p>
                }
              </div>

              <div class="totals-card">
                <div class="tot-row">
                  <span>Subtotal</span>
                  <strong>Bs {{ r.order.subtotal | number: '1.2-2' }}</strong>
                </div>
                <div class="tot-row">
                  <span>Envío</span>
                  <strong>{{ r.order.costo_envio > 0 ? ('Bs ' + (r.order.costo_envio | number: '1.2-2')) : 'Gratis' }}</strong>
                </div>
                @if (r.order.descuento > 0) {
                  <div class="tot-row discount">
                    <span>Descuento</span>
                    <strong>− Bs {{ r.order.descuento | number: '1.2-2' }}</strong>
                  </div>
                }
                <div class="tot-row total-highlight">
                  <span class="tot-final-lbl">Total cancelado</span>
                  <span class="tot-final-val">Bs {{ r.order.total | number: '1.2-2' }} BOB</span>
                </div>
              </div>
            </div>

            <div class="card-security-footer">
              <div class="security-seal">
                <div class="qr-preview-badge" aria-hidden="true">DM</div>
                <div>
                  <strong>Comprobante verificado</strong>
                  <p>Código de verificación: <code>{{ r.order.codigo_publico }}</code></p>
                </div>
              </div>
              <p class="policy-note">
                Garantía DrapeMind: tienes 30 días para hacer cambios en cualquier sucursal presentando este comprobante, digital o impreso.
              </p>
            </div>
          </article>
          }
        }
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--dm-bg, #F4F5EA);
      color: var(--dm-ink, #10110F);
      font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .receipt-public-page {
      padding: 0 16px 60px;
    }

    /* ---------- NAVBAR (spec §8) ---------- */
    .dm-navbar {
      position: sticky;
      top: 16px;
      z-index: 100;
      max-width: 860px;
      margin: 16px auto 32px;
      padding: 10px 12px 10px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      background: rgba(255, 255, 255, .82);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border: 1px solid rgba(255, 255, 255, .7);
      border-radius: var(--dm-radius-pill, 999px);
      box-shadow: var(--dm-shadow-sm, 0 6px 18px rgba(16, 17, 15, .06));
    }

    .brand-monogram {
      width: 40px;
      height: 40px;
      border-radius: var(--dm-radius-sm, 14px);
      background: var(--dm-ink, #10110F);
      color: var(--dm-lime, #DFFF3F);
      font-weight: 800;
      font-size: 16px;
      display: grid;
      place-items: center;
      letter-spacing: -0.5px;
      flex-shrink: 0;
    }

    .brand-text-col {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .brand-name {
      font-weight: 800;
      font-size: 15px;
      letter-spacing: -0.02em;
    }

    .brand-sub {
      font-size: 11px;
      color: var(--dm-text-muted, #7B7F75);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dm-store-btn {
      flex-shrink: 0;
      padding: 10px 18px;
      font-size: 13px;
    }

    .page-container {
      max-width: 860px;
      margin: 0 auto;
    }

    /* ---------- BOTONES (spec §16 + §27 microinteracciones) ---------- */
    .dm-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 44px;
      border-radius: var(--dm-radius-pill, 999px);
      padding: 13px 22px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      border: 1px solid transparent;
      cursor: pointer;
      transition: transform var(--dm-fast, 150ms) var(--dm-ease, cubic-bezier(.22,1,.36,1)),
                  box-shadow var(--dm-normal, 280ms) var(--dm-ease, cubic-bezier(.22,1,.36,1)),
                  background var(--dm-normal, 280ms) var(--dm-ease, cubic-bezier(.22,1,.36,1));
    }

    .dm-btn:active:not(:disabled) {
      transform: scale(.98);
    }

    .dm-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 4px rgba(223, 255, 63, .35);
    }

    .dm-btn:disabled {
      opacity: .6;
      cursor: not-allowed;
    }

    .dm-btn--primary {
      background: var(--dm-ink, #10110F);
      color: #FFFFFF;
    }

    .dm-btn--primary:hover:not(:disabled) {
      background: #2A2D25;
    }

    .dm-btn--secondary {
      background: var(--dm-surface, #FFFFFF);
      color: var(--dm-ink, #10110F);
      border-color: var(--dm-border, #E1E3DA);
    }

    .dm-btn--secondary:hover {
      background: var(--dm-surface-soft, #F8F9F2);
    }

    /* ---------- HERO DE VERIFICACIÓN ---------- */
    .verification-hero {
      text-align: center;
      margin-bottom: 28px;
    }

    .verified-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--dm-lime, #DFFF3F);
      color: var(--dm-ink, #10110F);
      padding: 7px 16px;
      border-radius: var(--dm-radius-pill, 999px);
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 16px;
    }

    .hero-title {
      font-size: clamp(1.75rem, 3vw, 3rem);
      line-height: 1.05;
      letter-spacing: -0.035em;
      font-weight: 600;
      margin: 0 0 10px;
    }

    .hero-sub {
      font-size: 14px;
      line-height: 1.6;
      color: var(--dm-text-muted, #7B7F75);
      max-width: 560px;
      margin: 0 auto 20px;
    }

    .hero-sub strong {
      color: var(--dm-ink, #10110F);
      font-weight: 700;
    }

    .auth-meta-row {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    .meta-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--dm-surface, #FFFFFF);
      border: 1px solid var(--dm-border, #E1E3DA);
      border-radius: var(--dm-radius-pill, 999px);
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      color: var(--dm-gray-700, #40433D);
    }

    .meta-tag--folio {
      background: var(--dm-ink, #10110F);
      color: #FFFFFF;
      border-color: var(--dm-ink, #10110F);
      font-family: monospace;
      font-weight: 700;
    }

    /* ---------- ACCIONES ---------- */
    .actions-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 12px;
      margin-bottom: 12px;
    }

    .pdf-error-toast {
      margin: 0 0 20px;
      padding: 10px 18px;
      background: rgba(232, 93, 93, .12);
      background: color-mix(in srgb, var(--dm-danger, #E85D5D) 12%, white);
      color: var(--dm-danger, #E85D5D);
      border-radius: var(--dm-radius-pill, 999px);
      font-size: 13px;
      font-weight: 600;
      text-align: center;
    }

    /* ---------- COMPROBANTE ---------- */
    .receipt-card {
      background: var(--dm-surface, #FFFFFF);
      border: 1px solid var(--dm-border, #E1E3DA);
      border-radius: var(--dm-radius-lg, 28px);
      padding: clamp(20px, 4vw, 40px);
      box-shadow: var(--dm-shadow-md, 0 14px 36px rgba(16, 17, 15, .08));
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      flex-wrap: wrap;
    }

    .card-brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .seal-box {
      width: 52px;
      height: 52px;
      border-radius: var(--dm-radius-sm, 14px);
      background: var(--dm-ink, #10110F);
      color: var(--dm-lime, #DFFF3F);
      display: grid;
      place-items: center;
      font-size: 20px;
      font-weight: 800;
      border: 2px solid var(--dm-lime, #DFFF3F);
      flex-shrink: 0;
    }

    .card-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    .card-sub {
      margin: 2px 0 0;
      font-size: 13px;
      color: var(--dm-text-muted, #7B7F75);
    }

    .card-legal {
      margin: 2px 0 0;
      font-size: 11px;
      color: var(--dm-text-muted, #7B7F75);
    }

    .status-box {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      padding: 5px 14px;
      border-radius: var(--dm-radius-pill, 999px);
    }

    .status-pill--success {
      background: rgba(87, 167, 115, .14);
      background: color-mix(in srgb, var(--dm-success, #57A773) 16%, white);
      color: var(--dm-success, #57A773);
      color: color-mix(in srgb, var(--dm-success, #57A773) 75%, black);
    }

    .status-pill--warning {
      background: rgba(228, 184, 77, .18);
      background: color-mix(in srgb, var(--dm-warning, #E4B84D) 20%, white);
      color: #8A6516;
      color: color-mix(in srgb, var(--dm-warning, #E4B84D) 65%, black);
    }

    .status-pill--info {
      background: var(--dm-cyan-soft, #E7F7F7);
      color: var(--dm-gray-700, #40433D);
    }

    .status-pill--danger {
      background: rgba(232, 93, 93, .14);
      background: color-mix(in srgb, var(--dm-danger, #E85D5D) 14%, white);
      color: var(--dm-danger, #E85D5D);
    }

    .status-pill--neutral {
      background: var(--dm-gray-100, #F0F1EB);
      color: var(--dm-gray-700, #40433D);
    }

    .folio-code {
      font-family: monospace;
      font-weight: 700;
      font-size: 16px;
    }

    .hairline {
      height: 1px;
      background: var(--dm-border, #E1E3DA);
      margin: 24px 0;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 18px;
      background: var(--dm-surface-soft, #F8F9F2);
      border: 1px solid var(--dm-border, #E1E3DA);
      border-radius: var(--dm-radius-md, 20px);
      padding: 20px 24px;
      margin-bottom: 24px;
    }

    .info-cell {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .info-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--dm-text-muted, #7B7F75);
      text-transform: uppercase;
    }

    .info-value {
      font-size: 14px;
      color: var(--dm-ink, #10110F);
    }

    .info-hint {
      font-size: 12px;
      color: var(--dm-text-muted, #7B7F75);
    }

    .table-wrap {
      overflow-x: auto;
      margin-bottom: 24px;
    }

    .receipt-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .receipt-table th {
      background: var(--dm-ink, #10110F);
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 12px 16px;
      text-align: left;
    }

    .receipt-table th:first-child { border-radius: var(--dm-radius-xs, 10px) 0 0 var(--dm-radius-xs, 10px); }
    .receipt-table th:last-child { border-radius: 0 var(--dm-radius-xs, 10px) var(--dm-radius-xs, 10px) 0; }

    .receipt-table td {
      padding: 14px 16px;
      border-bottom: 1px solid var(--dm-gray-100, #F0F1EB);
    }

    .sku-code {
      font-family: monospace;
      font-size: 12px;
      background: var(--dm-gray-100, #F0F1EB);
      padding: 3px 6px;
      border-radius: 6px;
    }

    .variant-tag {
      font-size: 12px;
      font-weight: 600;
      color: var(--dm-gray-700, #40433D);
    }

    .text-center { text-align: center; }
    .text-right { text-align: right; }

    .totals-section {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 24px;
      align-items: flex-start;
      margin-bottom: 24px;
    }

    @media (max-width: 680px) {
      .totals-section {
        grid-template-columns: 1fr;
      }
    }

    .payment-info-box {
      background: #FDFCFA;
      border: 1px solid var(--dm-border, #E1E3DA);
      border-radius: var(--dm-radius-sm, 14px);
      padding: 18px 20px;
    }

    .pay-method-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--dm-gray-100, #F0F1EB);
      border-radius: var(--dm-radius-pill, 999px);
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 700;
      margin: 8px 0;
      flex-wrap: wrap;
    }

    .pay-check {
      color: var(--dm-success, #57A773);
      font-weight: 700;
      font-size: 11px;
    }

    .pay-ref {
      font-size: 12px;
      color: var(--dm-text-muted, #7B7F75);
      margin: 4px 0 0;
    }

    .order-notes {
      font-size: 12px;
      color: var(--dm-gray-700, #40433D);
      margin: 8px 0 0;
      font-style: italic;
    }

    .totals-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .tot-row {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      color: var(--dm-gray-700, #40433D);
    }

    .tot-row strong {
      color: var(--dm-ink, #10110F);
    }

    .tot-row.discount {
      color: var(--dm-success, #57A773);
    }

    .tot-row.total-highlight {
      margin-top: 8px;
      padding: 14px 18px;
      background: var(--dm-ink, #10110F);
      border-radius: var(--dm-radius-sm, 14px);
      align-items: center;
    }

    .tot-final-lbl {
      color: var(--dm-lime, #DFFF3F);
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.04em;
    }

    .tot-final-val {
      color: #FFFFFF;
      font-weight: 800;
      font-size: 18px;
    }

    .card-security-footer {
      border-top: 1px dashed var(--dm-border, #E1E3DA);
      padding-top: 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .security-seal {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .qr-preview-badge {
      width: 38px;
      height: 38px;
      border-radius: var(--dm-radius-xs, 10px);
      background: var(--dm-ink, #10110F);
      color: var(--dm-lime, #DFFF3F);
      font-weight: 800;
      font-size: 14px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .security-seal strong {
      display: block;
      font-size: 12px;
      font-weight: 700;
    }

    .security-seal p {
      margin: 2px 0 0;
      font-size: 11px;
      color: var(--dm-text-muted, #7B7F75);
    }

    .policy-note {
      margin: 0;
      font-size: 11px;
      color: var(--dm-text-muted, #7B7F75);
      line-height: 1.5;
    }

    /* ---------- SKELETON (spec §29 — nada de spinner gigante) ---------- */
    .skeleton-wrap {
      display: flex;
      flex-direction: column;
      gap: 28px;
    }

    .skeleton-hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
    }

    .skeleton-card {
      background: var(--dm-surface, #FFFFFF);
      border: 1px solid var(--dm-border, #E1E3DA);
      border-radius: var(--dm-radius-lg, 28px);
      padding: clamp(20px, 4vw, 40px);
      box-shadow: var(--dm-shadow-md, 0 14px 36px rgba(16, 17, 15, .08));
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
    }

    .dm-skeleton {
      background: linear-gradient(90deg, #EBEDE5 25%, #F5F6F0 37%, #EBEDE5 63%);
      background-size: 400% 100%;
      animation: dm-shimmer 1.2s infinite;
      border-radius: var(--dm-radius-xs, 10px);
    }

    .skeleton-pill { width: 200px; height: 26px; border-radius: var(--dm-radius-pill, 999px); }
    .skeleton-title { width: min(420px, 70%); height: 34px; }
    .skeleton-line { width: min(320px, 60%); height: 14px; }
    .skeleton-row { width: 100%; height: 44px; }
    .skeleton-row--wide { height: 60px; }
    .skeleton-row--short { width: 50%; }
    .skeleton-block { height: 64px; }

    @keyframes dm-shimmer {
      0% { background-position: 100% 50%; }
      100% { background-position: 0 50%; }
    }

    .mini-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: dm-spin .6s linear infinite;
      display: inline-block;
    }

    @keyframes dm-spin {
      to { transform: rotate(360deg); }
    }

    /* ---------- ESTADO DE ERROR ---------- */
    .error-card {
      text-align: center;
      padding: 60px 20px;
      background: var(--dm-surface, #FFFFFF);
      border: 1px solid var(--dm-border, #E1E3DA);
      border-radius: var(--dm-radius-lg, 28px);
      max-width: 500px;
      margin: 40px auto;
    }

    .error-icon {
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: rgba(232, 93, 93, .12);
      background: color-mix(in srgb, var(--dm-danger, #E85D5D) 12%, white);
      color: var(--dm-danger, #E85D5D);
      font-size: 24px;
      font-weight: 700;
      display: grid;
      place-items: center;
      margin: 0 auto 16px;
    }

    .error-card h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0 0 8px;
    }

    .error-card p {
      color: var(--dm-text-muted, #7B7F75);
      margin: 0 0 20px;
    }

    /* ---------- ACCESIBILIDAD (spec §51) ---------- */
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: .01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: .01ms !important;
      }
    }

    @media print {
      body {
        background: #FFFFFF !important;
      }
      .dm-navbar, .verification-hero, .actions-bar, .pdf-error-toast {
        display: none !important;
      }
      .receipt-card {
        box-shadow: none !important;
        border: 1px solid var(--dm-ink, #10110F) !important;
        padding: 20px !important;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiptViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(StoreApiService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('printableCard') printableCardRef?: ElementRef<HTMLElement>;

  readonly loading = signal<boolean>(true);
  readonly error = signal<string>('');
  readonly receipt = signal<ReceiptData | null>(null);
  readonly generatingPdf = signal<boolean>(false);
  readonly pdfError = signal<string>('');

  readonly statusMeta = computed<StatusMeta>(() => {
    const estado = this.receipt()?.order?.estado ?? '';
    return ESTADO_META[estado] ?? { label: estado || 'Sin estado', tone: 'neutral' };
  });

  private pdfErrorTimeout?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const orderId = Number(idParam);

    if (!orderId || Number.isNaN(orderId)) {
      this.error.set('El número de comprobante no es válido.');
      this.loading.set(false);
      return;
    }

    // Intenta el endpoint público primero; si no existe o falla,
    // cae al endpoint autenticado como respaldo (mismo comportamiento
    // original, pero sin anidar subscribes).
    this.api
      .publicReceiptData(orderId)
      .pipe(
        catchError(() => this.api.receiptData(orderId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => {
          this.receipt.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(
            err?.error?.detail || 'No encontramos un comprobante emitido para este pedido.',
          );
          this.loading.set(false);
        },
      });
  }

  async downloadPdf(): Promise<void> {
    const el = this.printableCardRef?.nativeElement;
    if (!el || this.generatingPdf()) return;

    this.generatingPdf.set(true);
    this.pdfError.set('');

    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FFFFFF',
        scrollY: 0,
        scrollX: 0,
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const printWidth = pageWidth - margin * 2;
      const usablePageHeight = pageHeight - margin * 2;
      const printHeight = (canvas.height * printWidth) / canvas.width;

      if (printHeight <= usablePageHeight) {
        // Cabe en una sola hoja: comportamiento original.
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, printWidth, printHeight);
      } else {
        // El comprobante no entra en una sola página (pedidos con muchos
        // ítems): lo partimos en tantas hojas A4 como haga falta en vez
        // de recortarlo silenciosamente.
        const pageHeightInCanvasPx = (usablePageHeight * canvas.width) / printWidth;
        let renderedHeight = 0;
        let isFirstPage = true;

        while (renderedHeight < canvas.height) {
          const sliceHeight = Math.min(pageHeightInCanvasPx, canvas.height - renderedHeight);

          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sliceHeight;

          const ctx = pageCanvas.getContext('2d');
          ctx?.drawImage(
            canvas,
            0, renderedHeight, canvas.width, sliceHeight,
            0, 0, canvas.width, sliceHeight,
          );

          const sliceHeightMm = (sliceHeight * printWidth) / canvas.width;

          if (!isFirstPage) pdf.addPage();
          pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin, printWidth, sliceHeightMm);

          renderedHeight += sliceHeight;
          isFirstPage = false;
        }
      }

      const folio = this.receipt()?.order?.id;
      const filenameCode = folio !== undefined && folio !== null
        ? String(folio).padStart(5, '0')
        : 'documento';
      pdf.save(`comprobante-DrapeMind-DM-ORD-${filenameCode}.pdf`);
    } catch (e) {
      console.error('No se pudo generar el PDF del comprobante', e);
      this.pdfError.set('No pudimos generar el PDF. Inténtalo nuevamente.');
      clearTimeout(this.pdfErrorTimeout);
      this.pdfErrorTimeout = setTimeout(() => this.pdfError.set(''), 4000);
    } finally {
      this.generatingPdf.set(false);
    }
  }

  print(): void {
    window.print();
  }
}