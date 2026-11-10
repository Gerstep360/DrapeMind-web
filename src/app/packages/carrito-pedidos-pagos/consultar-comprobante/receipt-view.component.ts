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
import { catchError,firstValueFrom } from 'rxjs';
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
    if (estado === 'DEVUELTO') {
      return { label: 'Devolución y Reembolso', tone: 'warning' };
    }
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
      .publicReceiptData(
        orderId,
        this.route.snapshot.queryParamMap.get('code') || '',
        this.route.snapshot.queryParamMap.get('store') || '',
      )
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
    const id=this.receipt()?.order.id;
    if(!id || this.generatingPdf())return;
    this.generatingPdf.set(true);this.pdfError.set('');
    try {
      const blob=await firstValueFrom(this.api.receiptPdf(id));
      const url=URL.createObjectURL(blob);const anchor=document.createElement('a');
      anchor.href=url;anchor.download=`comprobante-${id}.pdf`;anchor.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){this.pdfError.set('No se pudo descargar el comprobante. Inicia sesión en la tienda y comprueba que el pago esté confirmado.');}
    finally{this.generatingPdf.set(false);}
  }

  print(): void {
    window.print();
  }
}
