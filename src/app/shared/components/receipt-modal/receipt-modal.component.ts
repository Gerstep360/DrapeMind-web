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
  readonly selectedFormat = signal<'pdf' | 'png'>('pdf');

  constructor() {
    effect(() => {
      const data = this.initialData();
      if (data) {
        this.receipt.set(data);
        this.loading.set(false);
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

  async downloadPdf(): Promise<void> {
    const el = this.voucherCanvasRef?.nativeElement || document.getElementById('receipt-voucher');
    if (!el || this.generatingPdf()) return;

    this.generatingPdf.set(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width / 2;
      const imgHeight = canvas.height / 2;

      const pdf = new jsPDF({
        orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: [imgWidth, imgHeight],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      const filename = `comprobante-DM-${this.receipt()?.order.id || this.orderId()}.pdf`;
      pdf.save(filename);
      this.toast.show('Comprobante PDF descargado exitosamente', 'success');
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
      });

      const filename = `comprobante-DM-${this.receipt()?.order.id || this.orderId()}.png`;
      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.toast.show('Imagen PNG descargada en alta resolución', 'success');
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
