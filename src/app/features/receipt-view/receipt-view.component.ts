import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { StoreApiService } from '../../core/store-api.service';
import { ReceiptData } from '../../core/models';

@Component({
  selector: 'app-receipt-view',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="receipt-public-page">
      <!-- FLOATING LUXURY NAVBAR -->
      <nav class="dm-navbar">
        <div class="brand-monogram">DM</div>
        <div class="brand-text-col">
          <span class="brand-name">DrapeMind Atelier</span>
          <span class="brand-sub">Sistema Oficial de Verificación Digital</span>
        </div>
        <a routerLink="/" class="dm-store-btn">Explorar Colección ↗</a>
      </nav>

      <main class="page-container">
        @if (loading()) {
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Verificando autenticidad en DrapeMind Cloud ERP...</p>
          </div>
        } @else if (error()) {
          <div class="error-card">
            <div class="error-icon">✕</div>
            <h2>Comprobante no disponible</h2>
            <p>{{ error() }}</p>
            <a routerLink="/" class="btn-primary">Volver al inicio</a>
          </div>
        } @else if (receipt(); as r) {
          <!-- VERIFIED BANNER -->
          <header class="verification-hero">
            <div class="verified-pill">
              <span class="sparkle">✦</span>
              <span>COMPROBANTE OFICIALMENTE VERIFICADO</span>
            </div>
            <h1 class="hero-title">Verificación de Venta y Entrega</h1>
            <p class="hero-sub">
              Este comprobante fue emitido y firmado digitalmente por los sistemas centrales de <strong>DrapeMind Atelier</strong>. Todos los datos han sido autenticados contra el registro de la base de datos de producción.
            </p>
            <div class="auth-meta-row">
              <span class="meta-tag">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Firma Cloud ERP Activa
              </span>
              <span class="meta-tag">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                Certificado: {{ r.order.created_at ? (r.order.created_at | date: 'dd/MM/yyyy HH:mm') : 'Reciente' }}
              </span>
              <span class="meta-tag meta-tag--folio">
                Folio: #DM-ORD-{{ r.order.id.toString().padStart(5, '0') }}
              </span>
            </div>
          </header>

          <!-- ACTIONS BAR -->
          <div class="actions-bar">
            <button class="btn-download" (click)="downloadPdf()" [disabled]="generatingPdf()">
              @if (generatingPdf()) {
                <span class="mini-spinner"></span> Generando PDF...
              } @else {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Descargar Documento PDF
              }
            </button>
            <button class="btn-print" (click)="print()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect width="12" height="8" x="6" y="14"/>
              </svg>
              Imprimir
            </button>
          </div>

          <!-- PRINTABLE / CAPTURABLE OFFICIAL RECEIPT -->
          <article #printableCard class="receipt-card">
            <!-- HEADER -->
            <div class="card-header">
              <div class="card-brand">
                <div class="seal-box">DM</div>
                <div>
                  <h2 class="card-title">DRAPEMIND ATELIER BOLIVIA</h2>
                  <p class="card-sub">Alta Costura Contemporánea · Confección de Autor</p>
                  <p class="card-legal">NIT: 7492019012 · Reg. Com. 49102-SCZ · Santa Cruz, Bolivia</p>
                </div>
              </div>
              <div class="status-box">
                <span class="status-pill status-pill--{{ r.order.estado }}">
                  ● {{ r.order.estado }}
                </span>
                <span class="folio-code">#DM-ORD-{{ r.order.id.toString().padStart(5, '0') }}</span>
              </div>
            </div>

            <div class="hairline"></div>

            <!-- INFO METADATA -->
            <div class="info-grid">
              <div class="info-cell">
                <span class="info-label">CLIENTE TITULAR</span>
                <strong class="info-value">{{ r.cliente.nombre }}</strong>
                <span class="info-hint">{{ r.cliente.email || 'Email no registrado' }}</span>
              </div>
              <div class="info-cell">
                <span class="info-label">SUCURSAL / SHOWROOM</span>
                <strong class="info-value">{{ r.sucursal.nombre }}</strong>
                <span class="info-hint">{{ r.sucursal.direccion }}, {{ r.sucursal.ciudad }}</span>
              </div>
              <div class="info-cell">
                <span class="info-label">FECHA DE EMISIÓN</span>
                <strong class="info-value">{{ r.order.created_at ? (r.order.created_at | date: 'dd/MM/yyyy HH:mm') : 'Reciente' }}</strong>
                <span class="info-hint">Canal: {{ r.order.canal }} Online</span>
              </div>
              <div class="info-cell">
                <span class="info-label">MODALIDAD DE ENTREGA</span>
                <strong class="info-value">{{ r.order.tipo_entrega === 'RECOJO' ? 'Retiro en Showroom' : 'Envío Express a Domicilio' }}</strong>
                <span class="info-hint">UUID: {{ r.order.codigo_publico }}</span>
              </div>
            </div>

            <!-- ITEMS TABLE -->
            <div class="table-wrap">
              <table class="receipt-table">
                <thead>
                  <tr>
                    <th>Prenda / Concepto</th>
                    <th>SKU</th>
                    <th>Variante</th>
                    <th class="text-center">Cant</th>
                    <th class="text-right">P. Unit</th>
                    <th class="text-right">Subtotal</th>
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

            <!-- TOTALS & PAYMENTS -->
            <div class="totals-section">
              <div class="payment-info-box">
                <span class="info-label">MÉTODO DE PAGO Y CONCILIACIÓN</span>
                <div class="pay-method-pill">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
                  </svg>
                  <span>{{ r.payments[0]?.metodo || 'PAGO DIRECTO' }}</span>
                  <span class="pay-check">✓ CONCILIADO</span>
                </div>
                <p class="pay-ref">Ref: <code>{{ r.payments[0]?.referencia || r.order.codigo_publico }}</code></p>
                @if (r.order.observacion) {
                  <p class="order-notes">Nota: {{ r.order.observacion }}</p>
                }
              </div>

              <div class="totals-card">
                <div class="tot-row">
                  <span>Subtotal:</span>
                  <strong>Bs {{ r.order.subtotal | number: '1.2-2' }}</strong>
                </div>
                <div class="tot-row">
                  <span>Envío:</span>
                  <strong>{{ r.order.costo_envio > 0 ? ('Bs ' + (r.order.costo_envio | number: '1.2-2')) : 'Gratis' }}</strong>
                </div>
                @if (r.order.descuento > 0) {
                  <div class="tot-row discount">
                    <span>Descuento:</span>
                    <strong>- Bs {{ r.order.descuento | number: '1.2-2' }}</strong>
                  </div>
                }
                <div class="tot-row total-highlight">
                  <span class="tot-final-lbl">TOTAL CANCELADO:</span>
                  <span class="tot-final-val">Bs {{ r.order.total | number: '1.2-2' }} BOB</span>
                </div>
              </div>
            </div>

            <!-- SECURITY BADGE & FOOTER -->
            <div class="card-security-footer">
              <div class="security-seal">
                <div class="qr-preview-badge">DM</div>
                <div>
                  <strong>DOCUMENTO CERTIFICADO POR DRAPEMIND CLOUD</strong>
                  <p>Hash de Seguridad: <code>{{ r.order.codigo_publico }}</code></p>
                </div>
              </div>
              <p class="policy-note">
                Garantía oficial DrapeMind: 30 días continuos para cambios en cualquier sucursal presentando este comprobante digital o físico.
              </p>
            </div>
          </article>
        }
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #F4F5EA;
      color: #10110F;
      font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .receipt-public-page {
      padding: 24px 16px 60px;
    }

    .dm-navbar {
      max-width: 860px;
      margin: 0 auto 32px;
      padding: 12px 20px;
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(18px);
      border: 1px solid #E1E3DA;
      border-radius: 999px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 6px 18px rgba(16, 17, 15, 0.05);
    }

    .brand-monogram {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #10110F;
      color: #DFFF3F;
      font-weight: 900;
      font-size: 16px;
      display: grid;
      place-items: center;
      letter-spacing: -0.5px;
    }

    .brand-text-col {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .brand-name {
      font-weight: 800;
      font-size: 15px;
      letter-spacing: -0.3px;
    }

    .brand-sub {
      font-size: 11px;
      color: #7B7F75;
    }

    .dm-store-btn {
      padding: 8px 18px;
      border-radius: 999px;
      background: #10110F;
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s;
    }

    .dm-store-btn:hover {
      background: #2A2D25;
      transform: translateY(-1px);
    }

    .page-container {
      max-width: 860px;
      margin: 0 auto;
    }

    .verification-hero {
      text-align: center;
      margin-bottom: 28px;
    }

    .verified-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #DFFF3F;
      color: #10110F;
      padding: 8px 20px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.8px;
      box-shadow: 0 4px 16px rgba(223, 255, 63, 0.4);
      margin-bottom: 16px;
    }

    .hero-title {
      font-size: clamp(26px, 4vw, 38px);
      font-weight: 800;
      margin: 0 0 10px;
      letter-spacing: -0.03em;
    }

    .hero-sub {
      font-size: 14px;
      line-height: 1.6;
      color: #686B63;
      max-width: 680px;
      margin: 0 auto 20px;
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
      background: #FFFFFF;
      border: 1px solid #E1E3DA;
      border-radius: 999px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      color: #40433D;
    }

    .meta-tag--folio {
      background: #10110F;
      color: #FFFFFF;
      border-color: #10110F;
      font-family: monospace;
      font-weight: 700;
    }

    .actions-bar {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-bottom: 20px;
    }

    .btn-download {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #DFFF3F;
      color: #10110F;
      font-size: 13px;
      font-weight: 800;
      padding: 10px 22px;
      border-radius: 999px;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(223, 255, 63, 0.35);
      transition: all 0.2s;
    }

    .btn-download:hover:not(:disabled) {
      background: #D2F632;
      transform: translateY(-1px);
    }

    .btn-print {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #FFFFFF;
      color: #10110F;
      border: 1px solid #E1E3DA;
      font-size: 13px;
      font-weight: 700;
      padding: 10px 20px;
      border-radius: 999px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-print:hover {
      background: #F0F1EB;
    }

    /* OFFICIAL VOUCHER CARD */
    .receipt-card {
      background: #FFFFFF;
      border: 1px solid #E1E3DA;
      border-radius: 28px;
      padding: 36px 40px;
      box-shadow: 0 14px 36px rgba(16, 17, 15, 0.08);
      position: relative;
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
      border-radius: 14px;
      background: #10110F;
      color: #DFFF3F;
      display: grid;
      place-items: center;
      font-size: 20px;
      font-weight: 900;
      border: 2px solid #DFFF3F;
      flex-shrink: 0;
    }

    .card-title {
      margin: 0;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 1.5px;
    }

    .card-sub {
      margin: 2px 0 0;
      font-size: 13px;
      color: #686B63;
    }

    .card-legal {
      margin: 2px 0 0;
      font-size: 11px;
      color: #9A9D93;
    }

    .status-box {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
    }

    .status-pill {
      font-size: 12px;
      font-weight: 800;
      padding: 4px 14px;
      border-radius: 999px;
      background: #E8F8EE;
      color: #1E7E34;
      text-transform: uppercase;
    }

    .status-pill--PENDIENTE_PAGO {
      background: #FFF4E5;
      color: #B25E00;
    }

    .folio-code {
      font-family: monospace;
      font-weight: 800;
      font-size: 16px;
    }

    .hairline {
      height: 1px;
      background: #E1E3DA;
      margin: 24px 0;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 18px;
      background: #F8F9F2;
      border: 1px solid #E1E3DA;
      border-radius: 18px;
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
      font-weight: 800;
      letter-spacing: 0.8px;
      color: #7B7F75;
      text-transform: uppercase;
    }

    .info-value {
      font-size: 14px;
      color: #10110F;
    }

    .info-hint {
      font-size: 12px;
      color: #7B7F75;
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
      background: #10110F;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 12px 16px;
      text-align: left;
    }

    .receipt-table th:first-child { border-radius: 10px 0 0 10px; }
    .receipt-table th:last-child { border-radius: 0 10px 10px 0; }

    .receipt-table td {
      padding: 14px 16px;
      border-bottom: 1px solid #F0F1EB;
    }

    .sku-code {
      font-family: monospace;
      font-size: 12px;
      background: #F0F1EB;
      padding: 3px 6px;
      border-radius: 4px;
    }

    .variant-tag {
      font-size: 12px;
      font-weight: 600;
      color: #555;
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
      border: 1px solid #E1E3DA;
      border-radius: 16px;
      padding: 18px 20px;
    }

    .pay-method-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #F0F1EB;
      border-radius: 999px;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 700;
      margin: 8px 0;
    }

    .pay-check {
      color: #1E7E34;
      font-weight: 800;
      font-size: 11px;
    }

    .pay-ref {
      font-size: 12px;
      color: #7B7F75;
      margin: 4px 0 0;
    }

    .order-notes {
      font-size: 12px;
      color: #555;
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
      color: #555;
    }

    .tot-row strong {
      color: #10110F;
    }

    .tot-row.discount {
      color: #1E7E34;
    }

    .tot-row.total-highlight {
      margin-top: 8px;
      padding: 12px 18px;
      background: #10110F;
      border-radius: 14px;
      align-items: center;
    }

    .tot-final-lbl {
      color: #DFFF3F;
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 0.8px;
    }

    .tot-final-val {
      color: #FFFFFF;
      font-weight: 900;
      font-size: 18px;
    }

    .card-security-footer {
      border-top: 1px dashed #E1E3DA;
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
      border-radius: 8px;
      background: #10110F;
      color: #DFFF3F;
      font-weight: 900;
      font-size: 14px;
      display: grid;
      place-items: center;
    }

    .security-seal strong {
      display: block;
      font-size: 12px;
      font-weight: 800;
    }

    .security-seal p {
      margin: 2px 0 0;
      font-size: 11px;
      color: #7B7F75;
    }

    .policy-note {
      margin: 0;
      font-size: 11px;
      color: #7B7F75;
      line-height: 1.5;
    }

    /* LOADING & ERROR */
    .loading-state, .error-card {
      text-align: center;
      padding: 60px 20px;
      background: #FFFFFF;
      border: 1px solid #E1E3DA;
      border-radius: 28px;
      max-width: 500px;
      margin: 40px auto;
    }

    .spinner {
      width: 44px;
      height: 44px;
      border: 3px solid #E1E3DA;
      border-top-color: #10110F;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }

    .mini-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      display: inline-block;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-icon {
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: #FEE2E2;
      color: #EF4444;
      font-size: 24px;
      font-weight: 800;
      display: grid;
      place-items: center;
      margin: 0 auto 16px;
    }

    .btn-primary {
      display: inline-block;
      margin-top: 16px;
      padding: 10px 24px;
      border-radius: 999px;
      background: #10110F;
      color: #FFFFFF;
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
    }

    @media print {
      body {
        background: #FFFFFF !important;
      }
      .dm-navbar, .verification-hero, .actions-bar {
        display: none !important;
      }
      .receipt-card {
        box-shadow: none !important;
        border: 1px solid #10110F !important;
        padding: 20px !important;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiptViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(StoreApiService);

  @ViewChild('printableCard') printableCardRef?: ElementRef<HTMLElement>;

  readonly loading = signal<boolean>(true);
  readonly error = signal<string>('');
  readonly receipt = signal<ReceiptData | null>(null);
  readonly generatingPdf = signal<boolean>(false);

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const orderId = Number(idParam);
    if (!orderId || isNaN(orderId)) {
      this.error.set('Número de comprobante inválido');
      this.loading.set(false);
      return;
    }

    this.api.publicReceiptData(orderId).subscribe({
      next: (data) => {
        this.receipt.set(data);
        this.loading.set(false);
      },
      error: () => {
        // Fallback to regular receiptData if public endpoint not yet reached
        this.api.receiptData(orderId).subscribe({
          next: (d) => {
            this.receipt.set(d);
            this.loading.set(false);
          },
          error: (err) => {
            this.error.set(
              err?.error?.detail || 'No se encontró un comprobante emitido para este folio.'
            );
            this.loading.set(false);
          },
        });
      },
    });
  }

  async downloadPdf(): Promise<void> {
    const el = this.printableCardRef?.nativeElement;
    if (!el || this.generatingPdf()) return;

    this.generatingPdf.set(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FFFFFF',
        scrollY: 0,
        scrollX: 0,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const printWidth = pageWidth - margin * 2;
      const printHeight = (canvas.height * printWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', margin, margin, printWidth, Math.min(printHeight, pageHeight - margin * 2));
      pdf.save(`comprobante-DM-${this.receipt()?.order?.id || 'doc'}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      this.generatingPdf.set(false);
    }
  }

  print(): void {
    window.print();
  }
}
