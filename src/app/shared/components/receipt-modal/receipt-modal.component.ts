import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { StoreApiService } from '../../../core/store-api.service';
import { ToastService } from '../../../core/toast.service';
import { ReceiptData } from '../../../core/models';

@Component({
  selector: 'app-receipt-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './receipt-modal.component.html',
  styleUrl: './receipt-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiptModalComponent {
  private readonly api = inject(StoreApiService);
  private readonly toast = inject(ToastService);

  readonly orderId = input.required<number>();
  readonly initialData = input<ReceiptData | null>(null);
  readonly close = output<void>();

  @ViewChild('voucherCanvas') voucherCanvasRef?: ElementRef<HTMLElement>;

  readonly loading = signal<boolean>(true);
  readonly receipt = signal<ReceiptData | null>(null);
  readonly generatingPdf = signal<boolean>(false);
  readonly generatingImage = signal<boolean>(false);
  readonly qrCodeDataUrl = signal<string>('');
  readonly verificationUrl = signal<string>('');

  constructor() {
    effect(() => {
      const data = this.initialData();
      if (data) {
        this.receipt.set(data);
        this.loading.set(false);
        void this.generateQrCode(data.order.id);
      } else {
        const id = this.orderId();
        if (id) {
          this.loadReceiptData(id);
        }
      }
    });
  }

  loadReceiptData(orderId: number): void {
    this.loading.set(true);
    this.api.receiptData(orderId).subscribe({
      next: (data) => {
        this.receipt.set(data);
        this.loading.set(false);
        void this.generateQrCode(data.order.id);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.show(
          err?.error?.detail || 'No se pudo cargar la información del comprobante',
          'error'
        );
      },
    });
  }

  async generateQrCode(orderId: number): Promise<void> {
    try {
      // Build absolute verification URL pointing to /receipt/:orderId
      const origin = window.location.origin;
      const baseEl = document.querySelector('base');
      const baseHref = (baseEl?.getAttribute('href') || '/').replace(/\/$/, '');
      const fullVerifyUrl = `${origin}${baseHref}/receipt/${orderId}`;
      this.verificationUrl.set(fullVerifyUrl);

      const qrDataUrl = await QRCode.toDataURL(fullVerifyUrl, {
        width: 180,
        margin: 1,
        color: {
          dark: '#10110F',
          light: '#FFFFFF',
        },
      });
      this.qrCodeDataUrl.set(qrDataUrl);
    } catch (e) {
      console.error('Error generating QR code:', e);
    }
  }

  async downloadPdf(): Promise<void> {
    const el = this.voucherCanvasRef?.nativeElement || document.getElementById('receipt-voucher');
    if (!el || this.generatingPdf()) return;

    this.generatingPdf.set(true);
    try {
      // Ensure canvas is rendered completely without clipping scrolled parents
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
        scrollY: 0,
        scrollX: 0,
        windowWidth: 1000,
        windowHeight: el.scrollHeight + 120,
        onclone: (clonedDoc) => {
          const voucher = clonedDoc.getElementById('receipt-voucher');
          if (voucher) {
            voucher.style.maxHeight = 'none';
            voucher.style.overflow = 'visible';
            voucher.style.height = 'auto';
            voucher.style.transform = 'none';
          }
        },
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
      const margin = 10; // 10mm
      const maxContentWidth = pageWidth - margin * 2;
      const maxContentHeight = pageHeight - margin * 2;

      let renderWidth = maxContentWidth;
      let renderHeight = (canvas.height * renderWidth) / canvas.width;

      // If it slightly exceeds A4 height, scale proportionally so it stays on 1 luxury page
      if (renderHeight > maxContentHeight) {
        renderHeight = maxContentHeight;
        renderWidth = (canvas.width * renderHeight) / canvas.height;
      }

      const xOffset = margin + (maxContentWidth - renderWidth) / 2;
      pdf.addImage(imgData, 'PNG', xOffset, margin, renderWidth, renderHeight);

      const filename = `comprobante-DM-${this.receipt()?.order.id || this.orderId()}.pdf`;
      pdf.save(filename);
      this.toast.show('Comprobante PDF generado y descargado con éxito', 'success');
    } catch (err) {
      console.error(err);
      this.toast.show('Error al generar el archivo PDF', 'error');
    } finally {
      this.generatingPdf.set(false);
    }
  }

  async downloadImage(): Promise<void> {
    const el = this.voucherCanvasRef?.nativeElement || document.getElementById('receipt-voucher');
    if (!el || this.generatingImage()) return;

    this.generatingImage.set(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
        scrollY: 0,
        scrollX: 0,
        windowWidth: 1000,
        windowHeight: el.scrollHeight + 120,
        onclone: (clonedDoc) => {
          const voucher = clonedDoc.getElementById('receipt-voucher');
          if (voucher) {
            voucher.style.maxHeight = 'none';
            voucher.style.overflow = 'visible';
            voucher.style.height = 'auto';
            voucher.style.transform = 'none';
          }
        },
      });

      const filename = `comprobante-DM-${this.receipt()?.order.id || this.orderId()}.png`;
      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.toast.show('Imagen PNG descargada en alta resolución completa', 'success');
    } catch (err) {
      console.error(err);
      this.toast.show('Error al exportar la imagen', 'error');
    } finally {
      this.generatingImage.set(false);
    }
  }

  printReceipt(): void {
    window.print();
  }
}
