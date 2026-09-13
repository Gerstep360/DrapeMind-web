import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RuntimeConfigService } from '@core/runtime-config.service';
import {
  garmentPresentationLabel,
  garmentPresentationType,
  hasUsableGarmentImage,
} from '@shared/presentation/garment-presentation';
import { ProductDetailAction, ProductDetailState } from './product-detail-modal.models';

@Component({
  selector: 'app-product-detail-modal',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './product-detail-modal.component.html',
  styleUrl: './product-detail-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailModalComponent {
  private readonly runtime = inject(RuntimeConfigService);
  private readonly failedImageIds = signal<ReadonlySet<number>>(new Set());

  readonly state = input.required<ProductDetailState>();
  readonly action = output<ProductDetailAction>();

  readonly detailModalOpen = computed(() => this.state().open);
  readonly loadingDetail = computed(() => this.state().loading);
  readonly selectedProduct = computed(() => this.state().product);
  readonly favoriteIds = computed(() => {
    const product = this.state().product;
    return new Set(this.state().favorite && product ? [product.id] : []);
  });
  readonly availableColors = computed(() => this.state().colors);
  readonly availableSizes = computed(() => this.state().sizes);
  readonly selectedColor = computed(() => this.state().selectedColor);
  readonly selectedSize = computed(() => this.state().selectedSize);
  readonly selectedQty = computed(() => this.state().selectedQuantity);
  readonly activeVariant = computed(() => this.state().activeVariant);
  readonly selectedVariantAvailability = computed(() => this.state().branchAvailability);
  readonly selectedBranchId = computed(() => this.state().selectedBranchId);
  readonly currentBranchStock = computed(() => this.state().selectedBranchStock);
  readonly currentBranchName = computed(() => this.state().selectedBranchName);
  readonly reserving = computed(() => this.state().reserving);

  imageUrl(_product?: ProductDetailState['product']): string | null {
    const product = this.state().product;
    if (!product || this.failedImageIds().has(product.id)) return null;
    const first = product.imagenes?.[0];
    const raw = typeof first === 'string' ? first : first?.url;
    return hasUsableGarmentImage(raw) ? this.runtime.resolveImageUrl(raw) : null;
  }

  getGarmentType(name: string) {
    return garmentPresentationType(name);
  }

  getGarmentLabel(name: string): string {
    return garmentPresentationLabel(name);
  }

  branchName(branchId: number): string {
    return this.state().branchNames[branchId] ?? `Sucursal #${branchId}`;
  }

  onImageError(_product?: ProductDetailState['product']): void {
    const product = this.state().product;
    if (!product) return;
    this.failedImageIds.update((ids) => new Set([...ids, product.id]));
  }

  closeDetail(): void {
    this.action.emit({ type: 'close' });
  }

  toggleFavorite(product: ProductDetailState['product']): void {
    if (product) this.action.emit({ type: 'toggle-favorite', product });
  }

  askAiAboutProduct(product: ProductDetailState['product']): void {
    if (product) this.action.emit({ type: 'ask-altair', product });
  }

  selectColor(color: string): void {
    this.action.emit({ type: 'select-color', color });
  }

  selectSize(size: string): void {
    this.action.emit({ type: 'select-size', size });
  }

  onBranchChange(branchId: number): void {
    this.action.emit({ type: 'select-branch', branchId });
  }

  changeQty(delta: number): void {
    this.action.emit({ type: 'change-quantity', delta });
  }

  reserveSelected(): void {
    this.action.emit({ type: 'reserve' });
  }

  addToCartFromModal(): void {
    this.action.emit({ type: 'add-to-cart' });
  }

  buyNowFromModal(): void {
    this.action.emit({ type: 'buy-now' });
  }
}
