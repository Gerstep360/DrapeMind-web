import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { DatePipe } from '@angular/common';
import { Branch, Product, ProductVariant } from '../../core/models';
import { InventoryMovement, StoreApiService } from '../../core/store-api.service';
import { ToastService } from '../../core/toast.service';
import { AuthService } from '../../core/auth.service';

interface InventoryRow {
  product: Product;
  variant: ProductVariant;
}

@Component({
  selector: 'app-inventory',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(StoreApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly products = signal<Product[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly branchId = signal(0);
  readonly observation = signal('');
  readonly movements = signal<InventoryMovement[]>([]);
  readonly movementTypeFilter = signal('');
  readonly filteredMovements = computed(() => {
    const filter = this.movementTypeFilter().toUpperCase();
    return this.movements().filter(m => !filter || m.tipo === filter);
  });
  readonly rows = signal<InventoryRow[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly search = signal('');
  readonly onlyCritical = signal(false);
  readonly visibleRows = computed(() => this.rows().filter(row =>
    (!this.onlyCritical() || row.variant.stock_disponible <= 3) &&
    [row.product.nombre, row.variant.sku, row.variant.color, row.variant.talla].join(' ')
      .toLowerCase().includes(this.search().trim().toLowerCase())));
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
    this.api.assignedBranches().subscribe({
      next: (branches) => {
        this.branches.set(branches);
        this.branchId.set(branches[0]?.id ?? 0);
        this.load();
      },
      error: () => { this.loading.set(false); this.toast.show('No se pudieron cargar las sucursales', 'error'); },
    });
  }

  selectBranch(value: string): void {
    this.branchId.set(Number(value));
    this.editorOpen.set(false);
    this.load();
  }

  load(): void {
    this.loadError.set('');
    if (!this.branchId()) { this.loading.set(false); return; }
    const branchId = this.branchId();
    this.movements.set([]);
    this.api.adminInventoryMovements({ sucursal_id: branchId, limit: 100 }).subscribe({
      next: (rows) => { if (branchId === this.branchId()) this.movements.set(rows); },
      error: () => this.toast.show('No se pudo consultar el historial de movimientos', 'error'),
    });
    this.loading.set(true);
    this.api.products({ con_stock: false, limit: 100 }).subscribe({
      next: (products) => {
        this.products.set(products);
        if (!products.length) {
          this.rows.set([]);
          this.loading.set(false);
          return;
        }
        forkJoin({details: forkJoin(products.map((product) => this.api.product(product.id))), stock: this.api.branchStock(branchId)}).subscribe({
          next: ({details, stock}) => {
            if (branchId !== this.branchId()) return;
            const byVariant = new Map(stock.map((row) => [row.variante_id, row]));
            const rows = details.flatMap((product) =>
              (product.variantes ?? []).map((variant) => {
                const local = byVariant.get(variant.id);
                return { product, variant: {...variant,
                  stock_total: local?.stock_total ?? 0,
                  stock_reservado: local?.stock_reservado ?? 0,
                  stock_disponible: local?.stock_disponible ?? 0,
                }};
              }),
            );
            this.rows.set(rows);
            this.stockDrafts.set(
              Object.fromEntries(rows.map(({ variant }) => [variant.id, variant.stock_total])),
            );
            this.loading.set(false);
          },
          error: () => { this.loading.set(false); this.loadError.set('No pudimos consultar las variantes y existencias. Reintenta.'); },
        });
      },
      error: () => { this.loading.set(false); this.loadError.set('No pudimos consultar el catálogo. Reintenta.'); },
    });
  }

  setStock(id: number, value: string): void {
    this.stockDrafts.update((drafts) => ({ ...drafts, [id]: Number(value) }));
  }

  saveStock(row: InventoryRow): void {
    if (this.savingId() !== null) return;
    const next = this.stockDrafts()[row.variant.id];
    if (!Number.isInteger(next) || next < 0 || this.observation().trim().length < 5) {
      this.toast.show('Indica unidades enteras y un motivo de al menos 5 caracteres', 'error');
      return;
    }
    if (next < row.variant.stock_reservado) {
      this.toast.show('El total no puede ser menor que las unidades reservadas', 'error');
      return;
    }
    if (next === row.variant.stock_total) return;
    this.savingId.set(row.variant.id);
    this.api.setBranchStock(this.branchId(), row.variant.id, next, this.observation().trim()).subscribe({
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

  actionLabel(row: InventoryRow): string {
    if (this.savingId() === row.variant.id) return '...';
    const draft = this.stockDrafts()[row.variant.id];
    if (draft > row.variant.stock_total) return 'Recibir (+)';
    if (draft < row.variant.stock_total) return 'Ajustar (-)';
    return 'Guardar';
  }
}
