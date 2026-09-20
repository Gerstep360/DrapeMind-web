import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { DatePipe } from '@angular/common';
import { Branch, Category, InventoryMovement, Product } from '@core/models';
import { BranchInventoryApiService } from '@core/api/branch-inventory-api.service';
import { CatalogApiService } from '@core/api/catalog-api.service';
import { BranchService } from '@core/branch.service';
import { ToastService } from '@core/toast.service';
import { AuthService } from '@core/auth.service';
import { InventoryRow } from './inventory.models';

@Component({
  selector: 'app-inventory',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryComponent {
  readonly auth = inject(AuthService);
  readonly branchService = inject(BranchService);
  private readonly inventoryApi = inject(BranchInventoryApiService);
  private readonly catalogApi = inject(CatalogApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly selectedCategory = signal<number | null>(null);
  readonly branches = signal<Branch[]>([]);
  readonly branchId = signal(0);
  readonly observation = signal('');
  readonly movements = signal<InventoryMovement[]>([]);
  readonly movementTypeFilter = signal('');
  readonly filteredMovements = computed(() => {
    const filter = this.movementTypeFilter().toUpperCase();
    return this.movements().filter((m) => !filter || m.tipo === filter);
  });
  readonly rows = signal<InventoryRow[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly search = signal('');
  readonly onlyCritical = signal(false);

  // Receive Variant Modal State
  readonly receiveModalOpen = signal(false);
  readonly activeReceiveRow = signal<InventoryRow | null>(null);
  readonly receiveQty = signal<number>(5);
  readonly receiveReason = signal<string>('Recepción de mercadería en showroom');

  readonly visibleRows = computed(() => {
    const catId = this.selectedCategory();
    const query = this.search().trim().toLowerCase();
    const onlyCrit = this.onlyCritical();

    return this.rows().filter((row) => {
      if (catId !== null && row.product.categoria_id !== catId) return false;
      if (onlyCrit && row.variant.stock_disponible > 3) return false;
      if (query) {
        const match = [row.product.nombre, row.variant.sku, row.variant.color, row.variant.talla]
          .join(' ')
          .toLowerCase()
          .includes(query);
        if (!match) return false;
      }
      return true;
    });
  });

  readonly groupedCategories = computed(() => {
    const rows = this.visibleRows();
    const cats = this.categories();
    const catMap = new Map<
      number,
      { id: number; nombre: string; rows: InventoryRow[]; totalUnits: number }
    >();

    for (const r of rows) {
      const cId = r.product.categoria_id || 0;
      if (!catMap.has(cId)) {
        const foundCat = cats.find((c) => c.id === cId);
        catMap.set(cId, {
          id: cId,
          nombre: foundCat ? foundCat.nombre : cId === 0 ? 'Sin categoría' : `Categoría #${cId}`,
          rows: [],
          totalUnits: 0,
        });
      }
      const group = catMap.get(cId)!;
      group.rows.push(r);
      group.totalUnits += r.variant.stock_total;
    }

    return Array.from(catMap.values());
  });

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

  // Acordeón / Dropdown de Categorías
  readonly collapsedCategories = signal<Set<number>>(new Set());

  toggleCategory(catId: number): void {
    this.collapsedCategories.update((set) => {
      const next = new Set(set);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  }

  isCategoryOpen(catId: number): boolean {
    return !this.collapsedCategories().has(catId);
  }

  categoryEmoji(name: string): string {
    const n = (name || '').toLowerCase();
    if (n.includes('vestido') || n.includes('dress')) return 'VEST';
    if (
      n.includes('camis') ||
      n.includes('top') ||
      n.includes('poler') ||
      n.includes('blusa') ||
      n.includes('remera') ||
      n.includes('polo')
    )
      return 'TOP';
    if (n.includes('pantalon') || n.includes('jean') || n.includes('short') || n.includes('falda'))
      return 'BOT';
    if (
      n.includes('abrigo') ||
      n.includes('chaqueta') ||
      n.includes('saco') ||
      n.includes('blazer') ||
      n.includes('chamarra')
    )
      return 'OUT';
    if (
      n.includes('calzad') ||
      n.includes('zapato') ||
      n.includes('tenis') ||
      n.includes('bota') ||
      n.includes('sneaker')
    )
      return 'CAL';
    if (
      n.includes('reloj') ||
      n.includes('accesorio') ||
      n.includes('joy') ||
      n.includes('cinturon') ||
      n.includes('corbata')
    )
      return 'ACC';
    if (
      n.includes('bols') ||
      n.includes('cartera') ||
      n.includes('mochila') ||
      n.includes('billetera')
    )
      return 'BAG';
    return 'DRP';
  }

  constructor() {
    this.catalogApi.categories().subscribe({
      next: (cats) => this.categories.set(cats),
    });
    this.catalogApi.products().subscribe({
      next: (prods) => this.products.set(prods),
    });
    this.inventoryApi.assignedBranches().subscribe({
      next: (branches) => {
        this.branches.set(branches);
        const currentActive = this.branchService.selectedBranchId();
        const matching = branches.find((b) => b.id === currentActive);
        const chosenId = matching ? matching.id : branches[0]?.id ?? 0;
        this.branchId.set(chosenId);
        if (matching) {
          this.branchService.selectBranch(matching);
        } else if (branches[0]) {
          this.branchService.selectBranch(branches[0]);
        }
        this.load();
      },
      error: () => {
        this.loading.set(false);
        this.toast.show('No se pudieron cargar las sucursales', 'error');
      },
    });

    // Reaccionar a cambios de sucursal global (topbar)
    effect(() => {
      const activeId = this.branchService.selectedBranchId();
      if (
        activeId &&
        activeId !== this.branchId() &&
        this.branches().some((b) => b.id === activeId)
      ) {
        untracked(() => {
          this.branchId.set(activeId);
          this.editorOpen.set(false);
          this.load();
        });
      }
    });
  }

  selectBranch(value: string): void {
    const id = Number(value);
    this.branchId.set(id);
    const found = this.branches().find((b) => b.id === id);
    if (found) {
      this.branchService.selectBranch(found);
    }
    this.editorOpen.set(false);
    this.load();
  }

  load(): void {
    this.loadError.set('');
    if (!this.branchId()) {
      this.loading.set(false);
      return;
    }
    const branchId = this.branchId();
    this.movements.set([]);
    this.inventoryApi.adminInventoryMovements({ sucursal_id: branchId, limit: 100 }).subscribe({
      next: (rows) => {
        if (branchId === this.branchId()) this.movements.set(rows);
      },
      error: () => this.toast.show('No se pudo consultar el historial de movimientos', 'error'),
    });
    this.loading.set(true);
    this.catalogApi.products({ con_stock: false, limit: 100 }).subscribe({
      next: (products) => {
        this.products.set(products);
        if (!products.length) {
          this.rows.set([]);
          this.loading.set(false);
          return;
        }
        forkJoin({
          details: forkJoin(products.map((product) => this.catalogApi.product(product.id))),
          stock: this.inventoryApi.branchStock(branchId),
        }).subscribe({
          next: ({ details, stock }) => {
            if (branchId !== this.branchId()) return;
            const byVariant = new Map(stock.map((row) => [row.variante_id, row]));
            const rows = details.flatMap((product) =>
              (product.variantes ?? []).map((variant) => {
                const local = byVariant.get(variant.id);
                return {
                  product,
                  variant: {
                    ...variant,
                    stock_total: local?.stock_total ?? 0,
                    stock_reservado: local?.stock_reservado ?? 0,
                    stock_disponible: local?.stock_disponible ?? 0,
                  },
                };
              }),
            );
            this.rows.set(rows);
            this.stockDrafts.set(
              Object.fromEntries(rows.map(({ variant }) => [variant.id, variant.stock_total])),
            );
            this.loading.set(false);
          },
          error: () => {
            this.loading.set(false);
            this.loadError.set('No pudimos consultar las variantes y existencias. Reintenta.');
          },
        });
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('No pudimos consultar el catálogo. Reintenta.');
      },
    });
  }

  setStock(id: number, value: string): void {
    this.stockDrafts.update((drafts) => ({ ...drafts, [id]: Number(value) }));
  }

  saveStock(row: InventoryRow, reasonOverride?: string): void {
    if (this.savingId() !== null) return;
    const next = this.stockDrafts()[row.variant.id];
    if (!Number.isInteger(next) || next < 0) {
      this.toast.show('Indica una cantidad de unidades válida', 'error');
      return;
    }
    if (next < row.variant.stock_reservado) {
      this.toast.show('El total no puede ser menor que las unidades reservadas', 'error');
      return;
    }
    if (next === row.variant.stock_total) return;

    let reason = (reasonOverride || this.observation()).trim();
    if (reason.length < 5) {
      if (next > row.variant.stock_total) {
        reason = `Recepción de mercadería (+${next - row.variant.stock_total} u.) en showroom`;
      } else {
        reason = `Ajuste manual de inventario (${next - row.variant.stock_total} u.) en showroom`;
      }
    }

    this.savingId.set(row.variant.id);
    this.inventoryApi.setBranchStock(this.branchId(), row.variant.id, next, reason).subscribe({
      next: () => {
        this.savingId.set(null);
        this.toast.show(
          `Stock de ${row.variant.sku} actualizado (${row.variant.stock_total} → ${next})`,
          'success',
        );
        this.load();
      },
      error: (error) => {
        this.savingId.set(null);
        this.toast.show(error?.error?.detail ?? 'No se pudo ajustar el stock', 'error');
      },
    });
  }

  openReceiveModal(row: InventoryRow): void {
    this.activeReceiveRow.set(row);
    this.receiveQty.set(5);
    this.receiveReason.set('Recepción de mercadería en showroom');
    this.receiveModalOpen.set(true);
  }

  closeReceiveModal(): void {
    this.receiveModalOpen.set(false);
    this.activeReceiveRow.set(null);
  }

  confirmReceive(): void {
    const row = this.activeReceiveRow();
    const qty = this.receiveQty();
    if (!row || !Number.isInteger(qty) || qty <= 0) {
      this.toast.show('Indica una cantidad mayor a 0', 'error');
      return;
    }
    const newTotal = row.variant.stock_total + qty;
    this.stockDrafts.update((drafts) => ({ ...drafts, [row.variant.id]: newTotal }));
    const reason = this.receiveReason().trim() || `Recepción de proveedor (+${qty} u.)`;
    this.closeReceiveModal();
    this.saveStock(row, reason);
  }

  quickAddStock(row: InventoryRow, amount: number): void {
    const current = this.stockDrafts()[row.variant.id] ?? row.variant.stock_total;
    const next = current + amount;
    this.stockDrafts.update((drafts) => ({ ...drafts, [row.variant.id]: next }));
    this.saveStock(row, `Recepción rápida (+${amount} u.) en tienda`);
  }

  createVariant(): void {
    if (this.variantForm.invalid) {
      this.variantForm.markAllAsTouched();
      return;
    }
    const value = this.variantForm.getRawValue();
    const productId = value.producto_id;
    const { producto_id, ...payload } = value;
    this.catalogApi.createVariant(productId, payload).subscribe({
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
