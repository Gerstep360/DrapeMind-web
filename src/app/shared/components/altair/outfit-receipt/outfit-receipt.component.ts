import { DecimalPipe, UpperCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { AiActionItem } from '@core/models';

@Component({
  selector: 'app-outfit-receipt',
  standalone: true,
  imports: [DecimalPipe, UpperCasePipe],
  templateUrl: './outfit-receipt.component.html',
  styleUrl: './outfit-receipt.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutfitReceiptComponent {
  @Input({ required: true }) responseMeta: any;
  @Input() actionItems: AiActionItem[] = [];

  @Output() applySelection = new EventEmitter<AiActionItem[]>();

  onApply(): void {
    this.applySelection.emit(this.actionItems);
  }
}
