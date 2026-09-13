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

  @ViewChild('voucherCanvas')
  voucherCanvasRef?: ElementRef<HTMLElement>;

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

        return;
      }

      const id = this.orderId();

      if (id) {
        this.loadReceiptData(id);
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
          err?.error?.detail ||
            'No se pudo cargar la información del comprobante',
          'error'
        );
      },
    });
  }

  async generateQrCode(orderId: number): Promise<void> {
    try {
      const origin = window.location.origin;

      const baseEl = document.querySelector('base');

      const rawBaseHref =
        baseEl?.getAttribute('href') || '/';

      const baseHref =
        rawBaseHref === '/'
          ? ''
          : rawBaseHref.replace(/\/$/, '');

      const fullVerifyUrl =
        `${origin}${baseHref}/receipt/${orderId}`;

      this.verificationUrl.set(fullVerifyUrl);

      const qrDataUrl = await QRCode.toDataURL(
        fullVerifyUrl,
        {
          width: 180,
          margin: 1,

          errorCorrectionLevel: 'M',

          color: {
            dark: '#10110F',
            light: '#FFFFFF',
          },
        }
      );

      this.qrCodeDataUrl.set(qrDataUrl);
    } catch (err) {
      console.error(
        'Error generating QR code:',
        err
      );
    }
  }

  /**
   * Captura el comprobante completo ignorando:
   *
   * - scroll del modal
   * - max-height
   * - overflow del preview
   * - límites visuales del contenedor
   *
   * De esta forma PDF y PNG capturan el voucher completo.
   */
  private async captureVoucher(): Promise<HTMLCanvasElement> {
    const el =
      this.voucherCanvasRef?.nativeElement ||
      document.getElementById('receipt-voucher');

    if (!el) {
      throw new Error(
        'No se encontró el comprobante para capturar'
      );
    }

    /*
     * Esperamos a que las fuentes terminen de cargar.
     * Esto evita diferencias de tamaño entre pantalla y exportación.
     */
    if ('fonts' in document) {
      await document.fonts.ready;
    }

    /*
     * Esperamos un frame para garantizar que Angular
     * haya terminado de pintar QR, textos y datos.
     */
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    const naturalWidth = el.scrollWidth;
    const naturalHeight = el.scrollHeight;

    const canvas = await html2canvas(el, {
      scale: 2,

      useCORS: true,

      logging: false,

      backgroundColor: '#FFFFFF',

      scrollX: 0,
      scrollY: 0,

      width: naturalWidth,
      height: naturalHeight,

      windowWidth: Math.max(
        1000,
        naturalWidth + 200
      ),

      windowHeight: Math.max(
        1200,
        naturalHeight + 200
      ),

      onclone: (clonedDoc) => {
        /*
         * Arreglamos únicamente el DOM clonado.
         * El modal visible para el usuario no cambia.
         */

        const backdrop =
          clonedDoc.querySelector<HTMLElement>(
            '.receipt-modal-backdrop'
          );

        const dialog =
          clonedDoc.querySelector<HTMLElement>(
            '.receipt-modal-dialog'
          );

        const preview =
          clonedDoc.querySelector<HTMLElement>(
            '.receipt-preview-body'
          );

        const wrapper =
          clonedDoc.querySelector<HTMLElement>(
            '.voucher-wrapper'
          );

        const voucher =
          clonedDoc.getElementById(
            'receipt-voucher'
          );

        if (backdrop) {
          backdrop.style.position = 'static';
          backdrop.style.inset = 'auto';

          backdrop.style.display = 'block';

          backdrop.style.width = 'auto';
          backdrop.style.height = 'auto';

          backdrop.style.padding = '0';

          backdrop.style.background =
            'transparent';

          backdrop.style.backdropFilter =
            'none';

          (
            backdrop.style as CSSStyleDeclaration & {
              webkitBackdropFilter?: string;
            }
          ).webkitBackdropFilter = 'none';
        }

        if (dialog) {
          dialog.style.width = 'auto';
          dialog.style.maxWidth = 'none';

          dialog.style.height = 'auto';
          dialog.style.minHeight = '0';
          dialog.style.maxHeight = 'none';

          dialog.style.display = 'block';

          dialog.style.overflow = 'visible';

          dialog.style.border = 'none';
          dialog.style.borderRadius = '0';

          dialog.style.boxShadow = 'none';

          dialog.style.transform = 'none';
        }

        if (preview) {
          preview.style.display = 'block';

          preview.style.width = 'auto';

          preview.style.height = 'auto';
          preview.style.minHeight = '0';
          preview.style.maxHeight = 'none';

          preview.style.overflow = 'visible';

          preview.style.padding = '0';

          preview.style.background =
            '#FFFFFF';
        }

        if (wrapper) {
          wrapper.style.display = 'block';

          wrapper.style.width = '720px';
          wrapper.style.minWidth = '720px';
          wrapper.style.maxWidth = '720px';

          wrapper.style.height = 'auto';
          wrapper.style.minHeight = '0';
          wrapper.style.maxHeight = 'none';

          wrapper.style.overflow = 'visible';

          wrapper.style.margin = '0';
          wrapper.style.padding = '0';

          wrapper.style.transform = 'none';
        }

        if (voucher) {
          voucher.style.display = 'flex';
          voucher.style.flexDirection =
            'column';

          voucher.style.width = '720px';
          voucher.style.minWidth = '720px';
          voucher.style.maxWidth = '720px';

          voucher.style.height = 'auto';
          voucher.style.minHeight =
            'max-content';
          voucher.style.maxHeight = 'none';

          voucher.style.overflow = 'visible';

          voucher.style.margin = '0';

          voucher.style.transform = 'none';

          voucher.style.boxSizing =
            'border-box';
        }
      },
    });

    return canvas;
  }

  async downloadPdf(): Promise<void> {
    if (
      this.generatingPdf() ||
      this.generatingImage()
    ) {
      return;
    }

    this.generatingPdf.set(true);

    try {
      const canvas =
        await this.captureVoucher();

      const imgData =
        canvas.toDataURL(
          'image/png',
          1.0
        );

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pageWidth =
        pdf.internal.pageSize.getWidth();

      const pageHeight =
        pdf.internal.pageSize.getHeight();

      /*
       * Márgenes del comprobante dentro del A4.
       */
      const marginX = 10;
      const marginY = 10;

      const maxContentWidth =
        pageWidth - marginX * 2;

      const maxContentHeight =
        pageHeight - marginY * 2;

      /*
       * Escalado proporcional.
       */
      let renderWidth =
        maxContentWidth;

      let renderHeight =
        (canvas.height *
          renderWidth) /
        canvas.width;

      /*
       * Si la altura supera la hoja A4,
       * reducimos proporcionalmente.
       *
       * Así el comprobante completo queda
       * en una sola página.
       */
      if (
        renderHeight >
        maxContentHeight
      ) {
        renderHeight =
          maxContentHeight;

        renderWidth =
          (canvas.width *
            renderHeight) /
          canvas.height;
      }

      /*
       * Centramos el voucher en la página.
       */
      const xOffset =
        (pageWidth -
          renderWidth) /
        2;

      const yOffset =
        (pageHeight -
          renderHeight) /
        2;

      pdf.addImage(
        imgData,
        'PNG',
        xOffset,
        yOffset,
        renderWidth,
        renderHeight,
        undefined,
        'FAST'
      );

      const filename =
        `comprobante-DM-${
          this.receipt()?.order.id ||
          this.orderId()
        }.pdf`;

      pdf.save(filename);

      this.toast.show(
        'Comprobante PDF generado y descargado con éxito',
        'success'
      );
    } catch (err) {
      console.error(
        'Error generating PDF:',
        err
      );

      this.toast.show(
        'Error al generar el archivo PDF',
        'error'
      );
    } finally {
      this.generatingPdf.set(false);
    }
  }

  async downloadImage(): Promise<void> {
    if (
      this.generatingImage() ||
      this.generatingPdf()
    ) {
      return;
    }

    this.generatingImage.set(true);

    try {
      const canvas =
        await this.captureVoucher();

      const filename =
        `comprobante-DM-${
          this.receipt()?.order.id ||
          this.orderId()
        }.png`;

      /*
       * Usamos Blob en vez de dataURL directo
       * para una descarga más estable.
       */
      const blob =
        await new Promise<Blob | null>(
          (resolve) => {
            canvas.toBlob(
              resolve,
              'image/png',
              1.0
            );
          }
        );

      if (!blob) {
        throw new Error(
          'No se pudo generar la imagen PNG'
        );
      }

      const objectUrl =
        URL.createObjectURL(blob);

      const link =
        document.createElement('a');

      link.download = filename;
      link.href = objectUrl;

      document.body.appendChild(link);

      link.click();

      link.remove();

      URL.revokeObjectURL(
        objectUrl
      );

      this.toast.show(
        'Imagen PNG descargada en alta resolución completa',
        'success'
      );
    } catch (err) {
      console.error(
        'Error exporting PNG:',
        err
      );

      this.toast.show(
        'Error al exportar la imagen',
        'error'
      );
    } finally {
      this.generatingImage.set(false);
    }
  }

  printReceipt(): void {
    window.print();
  }
}