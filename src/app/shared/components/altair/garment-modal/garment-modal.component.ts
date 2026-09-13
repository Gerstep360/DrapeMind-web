import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AiActionItem } from '@core/models';
import { RuntimeConfigService } from '@core/runtime-config.service';
import {
  garmentPresentationLabel,
  garmentPresentationType,
  hasUsableGarmentImage,
} from '@shared/presentation/garment-presentation';

@Component({
  selector: 'app-garment-modal',
  standalone: true,
  imports: [DecimalPipe, RouterLink],
  templateUrl: './garment-modal.component.html',
  styleUrl: './garment-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GarmentModalComponent {
  private readonly runtime = inject(RuntimeConfigService);

  @Input() garment: AiActionItem | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() addToCart = new EventEmitter<AiActionItem>();
  @Output() removeFromCart = new EventEmitter<AiActionItem>();

  onClose(): void {
    this.close.emit();
  }

  onAddToCart(): void {
    if (this.garment) {
      this.addToCart.emit(this.garment);
    }
  }

  onRemoveFromCart(): void {
    if (this.garment) {
      this.removeFromCart.emit(this.garment);
    }
  }

  cardImageUrl(item?: AiActionItem): string | null {
    const target = item || this.garment;
    return hasUsableGarmentImage(target?.imagen)
      ? this.runtime.resolveImageUrl(target.imagen)
      : null;
  }

  getGarmentType(name?: string) {
    return garmentPresentationType(name);
  }

  getGarmentLabel(name?: string): string {
    return garmentPresentationLabel(name);
  }
}
