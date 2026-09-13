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
  // Inputs
  @Input({ required: true }) open: boolean = false;
  @Input() product: Product | null = null;
  @Input() productStockRows: BranchStock[] = [];
  @Input() loading: boolean = false;
  @Input() branchId: number | null = null;
  @Input() branchName: string = '';

  // Outputs
  @Output() close = new EventEmitter<void>();
  @Output() addToTicket = new EventEmitter<{ variant: ProductVariant; maxStock: number }>();

  // Internal Signals for Selection
  readonly selectedColor = signal<string | null>(null);
  readonly selectedSize = signal<string | null>(null);

  constructor() {
    // Sincronizar selección inteligente cada vez que cambian el producto o las existencias
    effect(() => {
      const p = this.product;
      const colors = this.distinctColors();
      if (!p || colors.length === 0) {
        this.selectedColor.set(null);
        this.selectedSize.set(null);
        return;
      }

      // Si el color actual no existe en la lista de colores de esta prenda, preseleccionar
      const current = this.selectedColor();
      const hasCurrent =
        current && colors.some((c) => c.color.toLowerCase() === current.toLowerCase());

      if (!hasCurrent) {
        // Priorizar color con stock en esta sede
        const colorWithStock = colors.find((c) => {
          const variantsForColor = (p.variantes || []).filter((v) => {
            if (v.activo === false) return false;
            const vColor = (v.color ? v.color.trim() : 'Único').toLowerCase();
            return vColor === c.color.toLowerCase();
          });
          return variantsForColor.some((v) => this.getVariantBranchStock(v.id) > 0);
        });

        const chosenColor = colorWithStock ? colorWithStock.color : colors[0].color;
        this.selectColor(chosenColor);
      }
    });
  }

  /**
   * Agrupa los colores únicos para evitar que el mismo color se repita N veces,
   * y normaliza accesorios, relojes o prendas sin color a 'Único'
   */
  readonly distinctColors = computed<DistinctColor[]>(() => {
    const p = this.product;
    if (!p?.variantes || !Array.isArray(p.variantes) || p.variantes.length === 0) return [];

    const colorMap = new Map<string, DistinctColor>();

    for (const v of p.variantes) {
      if (v.activo === false) continue; // Solo omitir si explícitamente está inactivo

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

    return Array.from(colorMap.values());
  });

  /**
   * Tallas disponibles correspondientes al color actualmente seleccionado
   */
  readonly availableSizes = computed<ProductVariant[]>(() => {
    const p = this.product;
    const color = this.selectedColor();
    if (!p?.variantes || !Array.isArray(p.variantes)) return [];

    const targetColor = (color || 'Único').trim().toLowerCase();
    return p.variantes.filter((v) => {
      if (v.activo === false) return false;
      const vColor = (v.color ? v.color.trim() : 'Único').toLowerCase();
      return vColor === targetColor;
    });
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

    // Al cambiar de color, preseleccionar la primera talla que tenga stock en esta sucursal
    const p = this.product;
    if (!p?.variantes) return;

    const targetColor = (colorName || 'Único').trim().toLowerCase();
    const sizesForColor = p.variantes.filter((v) => {
      if (v.activo === false) return false;
      const vColor = (v.color ? v.color.trim() : 'Único').toLowerCase();
      return vColor === targetColor;
    });

    const sizeWithStock = sizesForColor.find((v) => this.getVariantBranchStock(v.id) > 0);
    const chosenSize = sizeWithStock ? sizeWithStock.talla : sizesForColor[0]?.talla || null;

    this.selectedSize.set(chosenSize);
  }

  selectSize(sizeName: string): void {
    this.selectedSize.set(sizeName);
  }

  getVariantBranchStock(variantId: number): number {
    if (!this.branchId) return 0;
    const match = this.productStockRows.find(
      (r) => r.variante_id === variantId && r.sucursal_id === this.branchId,
    );
    if (match) return match.stock_disponible;

    const p = this.product;
    const v = p?.variantes?.find((x) => x.id === variantId);
    return v?.stock_disponible ?? 0;
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
