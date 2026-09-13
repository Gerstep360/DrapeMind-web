import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { User } from '../../../../core/models';
import { CustomerMode, PaymentMethod, PosTicketItem } from '../../models/pos.models';

@Component({
  selector: 'app-pos-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DecimalPipe],
  templateUrl: './pos-ticket.component.html',
  styleUrl: './pos-ticket.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosTicketComponent {
  // Ticket items & status
  @Input() ticketItems: PosTicketItem[] = [];
  @Input() isSubmitting: boolean = false;
  @Input() totalPieces: number = 0;
  @Input() subtotal: number = 0;
  @Input() total: number = 0;
  @Input() cashChange: number = 0;
  @Input() isCashSufficient: boolean = true;
  @Input() canSubmitSale: boolean = false;

  // Customer Management
  @Input() customerMode: CustomerMode = 'WALK_IN';
  @Input({ required: true }) guestNameControl!: FormControl<string>;
  @Input({ required: true }) guestDocControl!: FormControl<string>;
  @Input({ required: true }) customerSearchControl!: FormControl<string>;
  @Input() customerSearchResults: User[] = [];
  @Input() isSearchingCustomers: boolean = false;
  @Input() selectedCustomer: User | null = null;

  // Payment Management
  @Input() paymentMethod: PaymentMethod = 'EFECTIVO';
  @Input({ required: true }) cashReceivedControl!: FormControl<number | null>;
  @Input({ required: true }) cardRefControl!: FormControl<string>;
  @Input({ required: true }) qrRefControl!: FormControl<string>;

  // Events
  @Output() customerModeChange = new EventEmitter<CustomerMode>();
  @Output() customerSelect = new EventEmitter<User>();
  @Output() clearCustomer = new EventEmitter<void>();
  @Output() increment = new EventEmitter<number>();
  @Output() decrement = new EventEmitter<number>();
  @Output() remove = new EventEmitter<number>();
  @Output() clearTicket = new EventEmitter<void>();
  @Output() paymentMethodChange = new EventEmitter<PaymentMethod>();
  @Output() submit = new EventEmitter<void>();

  setCustomerMode(mode: CustomerMode): void {
    this.customerModeChange.emit(mode);
  }

  onSelectCustomer(u: User): void {
    this.customerSelect.emit(u);
  }

  onClearCustomer(): void {
    this.clearCustomer.emit();
  }

  onIncrement(variantId: number): void {
    this.increment.emit(variantId);
  }

  onDecrement(variantId: number): void {
    this.decrement.emit(variantId);
  }

  onRemove(variantId: number): void {
    this.remove.emit(variantId);
  }

  onClearTicket(): void {
    this.clearTicket.emit();
  }

  setPaymentMethod(method: PaymentMethod): void {
    this.paymentMethodChange.emit(method);
  }

  onSubmit(): void {
    this.submit.emit();
  }
}
