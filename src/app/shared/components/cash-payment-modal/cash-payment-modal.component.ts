import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommerceApiService } from '@core/api/commerce-api.service';
import { ToastService } from '@core/toast.service';
import { Order } from '@core/models';

@Component({
  selector: 'app-cash-payment-modal',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './cash-payment-modal.component.html',
  styleUrl: './cash-payment-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashPaymentModalComponent {
  private readonly commerceApi = inject(CommerceApiService);
  private readonly toast = inject(ToastService);

  readonly order = input.required<Order>();
  readonly close = output<void>();
  readonly processed = output<{ order: Order; cashReceived: number; change: number }>();

  @ViewChild('cashInputRef') cashInputRef?: ElementRef<HTMLInputElement>;

  readonly cashReceived = signal<number | null>(null);
  readonly processing = signal<boolean>(false);

  readonly total = computed(() => this.order().total);

  readonly quickBills = computed(() => {
    const t = this.total();
    if (!t || t <= 0) return [50, 100, 200];
    const bills: number[] = [];
    const step = t > 500 ? 100 : t > 100 ? 50 : 20;
    let nextRound = Math.ceil(t / step) * step;
    if (nextRound <= t) nextRound += step;
    bills.push(nextRound);

    const nextRound2 = nextRound + (step === 20 ? 50 : step);
    if (!bills.includes(nextRound2)) bills.push(nextRound2);

    if (t <= 500 && !bills.includes(500)) {
      bills.push(500);
    } else if (t > 500 && !bills.includes(1000)) {
      bills.push(1000);
    }

    return bills.slice(0, 3);
  });

  readonly change = computed(() => {
    const received = this.cashReceived();
    if (received === null) return 0;
    const diff = received - this.total();
    return diff > 0 ? Number(diff.toFixed(2)) : 0;
  });

  readonly isSufficient = computed(() => {
    const received = this.cashReceived();
    if (received === null) return false;
    return received >= this.total();
  });

  readonly missing = computed(() => {
    const received = this.cashReceived();
    if (received === null) return this.total();
    const diff = this.total() - received;
    return diff > 0 ? Number(diff.toFixed(2)) : 0;
  });

  formatOrderId(id: number): string {
    return id.toString().padStart(5, '0');
  }

  setExactCash(): void {
    this.cashReceived.set(this.total());
    this.focusInput();
  }

  setBill(amount: number): void {
    this.cashReceived.set(amount);
    this.focusInput();
  }

  onCashInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (!val || isNaN(Number(val))) {
      this.cashReceived.set(null);
    } else {
      this.cashReceived.set(Math.max(0, Number(val)));
    }
  }

  private focusInput(): void {
    setTimeout(() => {
      this.cashInputRef?.nativeElement?.select();
    }, 50);
  }

  onDismiss(): void {
    if (!this.processing()) {
      this.close.emit();
    }
  }

  processPayment(): void {
    const received = this.cashReceived();
    if (received === null || !this.isSufficient()) {
      this.toast.show('El monto recibido debe cubrir el total a pagar.', 'error');
      return;
    }

    const currentOrder = this.order();
    const calculatedChange = this.change();

    this.processing.set(true);

    this.commerceApi.confirmCashPayment(currentOrder.id).subscribe({
      next: () => {
        this.processing.set(false);

        if (calculatedChange > 0) {
          this.toast.show(
            `Cobro registrado con éxito para el pedido #${currentOrder.id}. Entregar cambio de Bs. ${calculatedChange.toFixed(2)} al cliente.`,
            'success',
          );
        } else {
          this.toast.show(
            `Cobro en efectivo registrado para el pedido #${currentOrder.id}. Pago exacto confirmado.`,
            'success',
          );
        }

        this.processed.emit({
          order: currentOrder,
          cashReceived: received,
          change: calculatedChange,
        });
        this.close.emit();
      },
      error: (error) => {
        this.processing.set(false);
        this.toast.show(
          error?.error?.detail ?? 'No se pudo confirmar el cobro en efectivo.',
          'error',
        );
      },
    });
  }
}
