import { CommonModule, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { BranchStock, Product, ProductVariant } from '@core/models';
import { DistinctColor } from '../pos.models';

@Component({
  selector: 'app-pos-product-modal',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './pos-product-modal.component.html',
  styleUrl: './pos-product-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosProductModalComponent {
  // Inputs reactivos mediante setters y signals
  private readonly _product = signal<Product | null>(null);
  @Input() set product(val: Product | null) {
    this._product.set(val);
  }
  get product(): Product | null {
    return this._product();
  }

  private readonly _productStockRows = signal<BranchStock[]>([]);
  @Input() set productStockRows(val: BranchStock[]) {
    this._productStockRows.set(val || []);
  }
  get productStockRows(): BranchStock[] {
    return this._productStockRows();
  }

  private readonly _branchId = signal<number | null>(null);
  @Input() set branchId(val: number | null) {
    this._branchId.set(val);
  }
  get branchId(): number | null {
    return this._branchId();
  }

  @Input({ required: true }) open: boolean = false;
  @Input() loading: boolean = false;
  @Input() branchName: string = '';

  // Outputs
  @Output() close = new EventEmitter<void>();
  @Output() addToTicket = new EventEmitter<{ variant: ProductVariant; maxStock: number }>();

  // Internal Signals for Selection
  readonly selectedColor = signal<string | null>(null);
  readonly selectedSize = signal<string | null>(null);

  constructor() {
    // Sincronizar selección inteligente reactiva cada vez que cambia el producto o sus variantes
    effect(() => {
      const colors = this.distinctColors();
      if (colors.length === 0) {
        this.selectedColor.set(null);
        this.selectedSize.set(null);
        return;
      }

      const current = this.selectedColor();
      const hasCurrent =
        current && colors.some((c) => c.color.toLowerCase() === current.toLowerCase());

      if (!hasCurrent) {
        const chosenColor = colors[0].color;
        this.selectColor(chosenColor);
      }
    });
  }

  /**
   * Agrupa los colores únicos para evitar que el mismo color se repita N veces,
   * y normaliza accesorios, relojes o prendas sin color a 'Único'
   */
  readonly distinctColors = computed<DistinctColor[]>(() => {
    const p = this._product();
    if (!p) return [];

    const variants = p.variantes || [];
    if (variants.length === 0) {
      return [
        {
          color: 'Único',
          hex: '#B8BAC2',
          count: 1,
        },
      ];
    }

    const colorMap = new Map<string, DistinctColor>();

    for (const v of variants) {
      if (v.activo === false) continue;

      const rawColor = v.color ? v.color.trim() : '';
      const cleanName = rawColor || 'Único';
      const key = cleanName.toLowerCase();

      if (!colorMap.has(key)) {
        colorMap.set(key, {
          color: cleanName,
          hex: v.codigo_color || (cleanName === 'Único' ? '#B8BAC2' : null),
          count: 1,
        });
      } else {
        const existing = colorMap.get(key)!;
        existing.count++;
      }
    }

    if (colorMap.size === 0) {
      return [
        {
          color: 'Único',
          hex: '#B8BAC2',
          count: 1,
        },
      ];
    }

    return Array.from(colorMap.values());
  });

  /**
   * Tallas disponibles correspondientes al color actualmente seleccionado
   */
  readonly availableSizes = computed<ProductVariant[]>(() => {
    const p = this._product();
    if (!p) return [];

    const variants = p.variantes || [];
    if (variants.length === 0) {
      return [
        {
          id: p.id,
          producto_id: p.id,
          sku: `SKU-${p.id}`,
          color: 'Único',
          codigo_color: '#B8BAC2',
          talla: 'U',
          stock_total: 10,
          stock_disponible: 10,
          stock_reservado: 0,
          activo: true,
          imagen: null,
        },
      ];
    }

    const color = this.selectedColor();
    const targetColor = (color || 'Único').trim().toLowerCase();

    const matched = variants.filter((v) => {
      if (v.activo === false) return false;
      const vColor = (v.color ? v.color.trim() : 'Único').toLowerCase();
      return vColor === targetColor;
    });

    return matched.length > 0 ? matched : variants.filter((v) => v.activo !== false);
  });

  /**
   * Variante exacta según el color y la talla seleccionados
   */
  readonly selectedVariant = computed<ProductVariant | null>(() => {
    const sizes = this.availableSizes();
    const s = this.selectedSize();
    if (sizes.length === 0) return null;
    if (!s) return sizes[0];

    return sizes.find((v) => v.talla === s) || sizes[0];
  });

  selectColor(colorName: string): void {
    this.selectedColor.set(colorName);

    const sizes = this.availableSizes();
    if (sizes.length === 0) {
      this.selectedSize.set(null);
      return;
    }

    const sizeWithStock = sizes.find((v) => this.getVariantBranchStock(v.id) > 0);
    this.selectedSize.set(sizeWithStock ? sizeWithStock.talla : sizes[0].talla);
  }

  selectSize(sizeName: string): void {
    this.selectedSize.set(sizeName);
  }

  getVariantBranchStock(variantId: number): number {
    const branchId = this._branchId();
    const rows = this._productStockRows();
    if (!branchId) return 0;

    const match = rows.find(
      (r) => r.variante_id === variantId && r.sucursal_id === branchId,
    );
    if (match) return match.stock_disponible;

    const p = this._product();
    const v = p?.variantes?.find((x) => x.id === variantId);
    if (v?.stock_disponible !== undefined && v.stock_disponible !== null) {
      return v.stock_disponible;
    }

    return rows.length === 0 ? 10 : 0;
  }

  onClose(): void {
    this.close.emit();
  }

  onAddSelectedVariant(): void {
    const variant = this.selectedVariant();
    if (!variant) return;

    const maxStock = this.getVariantBranchStock(variant.id);
    if (maxStock <= 0) return;

    this.addToTicket.emit({ variant, maxStock });
  }
}
