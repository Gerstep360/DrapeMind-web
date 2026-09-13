import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { Product } from '@core/models';
import { RuntimeConfigService } from '@core/runtime-config.service';
import {
  garmentPresentationLabel,
  garmentPresentationType,
  hasUsableGarmentImage,
} from '@shared/presentation/garment-presentation';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCardComponent {
  private readonly runtime = inject(RuntimeConfigService);
  private failedImage = false;

  @Input({ required: true }) product!: Product;
  @Input() favorite = false;

  @Output() productOpen = new EventEmitter<Product>();
  @Output() favoriteChange = new EventEmitter<Product>();

  imageUrl(): string | null {
    if (this.failedImage) return null;
    const first = this.product.imagenes?.[0];
    const raw = typeof first === 'string' ? first : first?.url;
    return hasUsableGarmentImage(raw) ? this.runtime.resolveImageUrl(raw) : null;
  }

  garmentType() {
    return garmentPresentationType(this.product.nombre);
  }

  garmentLabel(): string {
    return garmentPresentationLabel(this.product.nombre);
  }

  open(): void {
    this.productOpen.emit(this.product);
  }

  toggleFavorite(event: Event): void {
    event.stopPropagation();
    this.favoriteChange.emit(this.product);
  }

  markImageAsUnavailable(): void {
    this.failedImage = true;
  }
}
