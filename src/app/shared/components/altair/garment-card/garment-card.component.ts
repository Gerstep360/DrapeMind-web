import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { AiActionItem } from '@core/models';
import { RuntimeConfigService } from '@core/runtime-config.service';
import {
  garmentPresentationLabel,
  garmentPresentationType,
  hasUsableGarmentImage,
} from '@shared/presentation/garment-presentation';

@Component({
  selector: 'app-garment-card',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './garment-card.component.html',
  styleUrl: './garment-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GarmentCardComponent {
  private readonly runtime = inject(RuntimeConfigService);

  @Input({ required: true }) item!: AiActionItem;
  @Input() index = 0;

  @Output() cardClick = new EventEmitter<AiActionItem>();
  @Output() quickAdd = new EventEmitter<AiActionItem>();

  cardImageUrl(): string | null {
    return hasUsableGarmentImage(this.item.imagen)
      ? this.runtime.resolveImageUrl(this.item.imagen)
      : null;
  }

  getGarmentType(name: string) {
    return garmentPresentationType(name);
  }

  getGarmentLabel(name: string): string {
    return garmentPresentationLabel(name);
  }

  onCardClick(): void {
    this.cardClick.emit(this.item);
  }

  onQuickAddClick(event: Event): void {
    event.stopPropagation();
    if (this.item.accion === 'AGREGAR') {
      this.quickAdd.emit(this.item);
    } else {
      this.cardClick.emit(this.item);
    }
  }
}
