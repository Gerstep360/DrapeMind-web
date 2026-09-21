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
import { CommerceApiService } from '@core/api/commerce-api.service';
import { ReceiptData } from '@core/models';
import { RECEIPT_STATUS_META, ReceiptStatusMeta } from './receipt-view.models';

/**
 * Tono visual de cada estado de pedido, mapeado a los tokens de estado
 * del design system (--dm-success / --dm-warning / --dm-danger).
 * Si el backend agrega un estado nuevo que no está en este mapa,
 * el pill cae a la variante "neutral" en vez de quedar sin estilo.
 */

@Component({
  selector: 'app-receipt-view',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './receipt-view.component.html',
  styleUrl: './receipt-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiptViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(CommerceApiService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('printableCard') printableCardRef?: ElementRef<HTMLElement>;

  readonly loading = signal<boolean>(true);
  readonly error = signal<string>('');
  readonly receipt = signal<ReceiptData | null>(null);
  readonly generatingPdf = signal<boolean>(false);
  readonly pdfError = signal<string>('');

  readonly statusMeta = computed<ReceiptStatusMeta>(() => {
    const estado = this.receipt()?.order?.estado ?? '';
    return RECEIPT_STATUS_META[estado] ?? { label: estado || 'Sin estado', tone: 'neutral' };
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
        next: (data: any) => {
          this.receipt.set(data as ReceiptData);
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
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FFFFFF',
        scrollY: 0,
        scrollX: 0,
      });

      const { jsPDF } = await import('jspdf');
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
            0,
            renderedHeight,
            canvas.width,
            sliceHeight,
            0,
            0,
            canvas.width,
            sliceHeight,
          );

          const sliceHeightMm = (sliceHeight * printWidth) / canvas.width;

          if (!isFirstPage) pdf.addPage();
          pdf.addImage(
            pageCanvas.toDataURL('image/png'),
            'PNG',
            margin,
            margin,
            printWidth,
            sliceHeightMm,
          );

          renderedHeight += sliceHeight;
          isFirstPage = false;
        }
      }

      const folio = this.receipt()?.order?.id;
      const filenameCode =
        folio !== undefined && folio !== null ? String(folio).padStart(5, '0') : 'documento';
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
