import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Product, ProductVariant } from '../../core/models';
import { StoreApiService } from '../../core/store-api.service';
import { ToastService } from '../../core/toast.service';

interface InventoryRow {
  product: Product;
  variant: ProductVariant;
}

@Component({
  selector: 'app-inventory',
  imports: [ReactiveFormsModule],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryComponent {
  private readonly api = inject(StoreApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly products = signal<Product[]>([]);
  readonly rows = signal<InventoryRow[]>([]);
  readonly loading = signal(true);
  readonly editorOpen = signal(false);
  readonly stockDrafts = signal<Record<number, number>>({});
  readonly savingId = signal<number | null>(null);
  readonly variantForm = this.fb.nonNullable.group({
    producto_id: [0, [Validators.required, Validators.min(1)]],
    sku: ['', Validators.required],
    color: ['', Validators.required],
    codigo_color: [''],
    talla: ['', Validators.required],
    stock_total: [0, [Validators.required, Validators.min(0)]],
    codigo_barras: [''],
    imagen: [''],
    activo: [true],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.products({ con_stock: false, limit: 100 }).subscribe({
      next: (products) => {
        this.products.set(products);
        if (!products.length) {
          this.rows.set([]);
          this.loading.set(false);
          return;
        }
        forkJoin(products.map((product) => this.api.product(product.id))).subscribe({
          next: (details) => {
            const rows = details.flatMap((product) =>
              (product.variantes ?? []).map((variant) => ({ product, variant })),
            );
            this.rows.set(rows);
            this.stockDrafts.set(
              Object.fromEntries(rows.map(({ variant }) => [variant.id, variant.stock_total])),
            );
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  setStock(id: number, value: string): void {
    this.stockDrafts.update((drafts) => ({ ...drafts, [id]: Number(value) }));
  }

  saveStock(row: InventoryRow): void {
    const next = this.stockDrafts()[row.variant.id];
    if (next === row.variant.stock_total || next < row.variant.stock_reservado) return;
    this.savingId.set(row.variant.id);
    this.api.adjustInventory(row.variant.id, next, 'Ajuste desde panel web').subscribe({
      next: () => {
        this.savingId.set(null);
        this.toast.show(`Stock de ${row.variant.sku} actualizado`, 'success');
        this.load();
      },
      error: (error) => {
        this.savingId.set(null);
        this.toast.show(error?.error?.detail ?? 'No se pudo ajustar el stock', 'error');
      },
    });
  }

  createVariant(): void {
    if (this.variantForm.invalid) {
      this.variantForm.markAllAsTouched();
      return;
    }
    const value = this.variantForm.getRawValue();
    const productId = value.producto_id;
    const { producto_id, ...payload } = value;
    this.api.createVariant(productId, payload).subscribe({
      next: () => {
        this.editorOpen.set(false);
        this.variantForm.reset({
          producto_id: 0,
          sku: '',
          color: '',
          codigo_color: '',
          talla: '',
          stock_total: 0,
          codigo_barras: '',
          imagen: '',
          activo: true,
        });
        this.toast.show('Variante creada correctamente', 'success');
        this.load();
      },
      error: (error) =>
        this.toast.show(error?.error?.detail ?? 'No se pudo crear la variante', 'error'),
    });
  }

  get availableUnits(): number {
    return this.rows().reduce(
      (total, row) => total + row.variant.stock_total - row.variant.stock_reservado,
      0,
    );
  }

  get criticalCount(): number {
    return this.rows().filter((row) => row.variant.stock_disponible <= 3).length;
  }
}
