import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Category, Product } from '../../../../core/models';

@Component({
  selector: 'app-pos-catalog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DecimalPipe],
  templateUrl: './pos-catalog.component.html',
  styleUrl: './pos-catalog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosCatalogComponent {
  @Input() products: Product[] = [];
  @Input() categories: Category[] = [];
  @Input() loading: boolean = false;
  @Input() selectedCategory: number | null = null;
  @Input({ required: true }) searchControl!: FormControl<string>;

  @Output() categorySelected = new EventEmitter<number | null>();
  @Output() productSelected = new EventEmitter<Product>();

  getProductImage(product: Product): string | undefined {
    if (!product.imagenes || product.imagenes.length === 0) return undefined;
    const first = product.imagenes[0];
    if (typeof first === 'string') return first;
    return first?.url;
  }

  getCategoryName(catId: number): string {
    const found = this.categories.find((c) => c.id === catId);
    return found ? found.nombre : 'Moda';
  }

  onSelectCategory(catId: number | null): void {
    this.categorySelected.emit(catId);
  }

  onSelectProduct(product: Product): void {
    this.productSelected.emit(product);
  }
}
