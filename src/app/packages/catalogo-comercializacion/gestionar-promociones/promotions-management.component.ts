import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApiService } from '@core/api/admin-api.service';
import { Product, Promotion, PromotionInput } from '@core/models';
import { ToastService } from '@core/toast.service';

@Component({
  selector: 'app-promotions-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './promotions-management.component.html',
  styleUrl: './promotions-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromotionsManagementComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);

  readonly promotions = signal<Promotion[]>([]);
  readonly availableProducts = signal<Product[]>([]);
  readonly selectedGarment = signal<Product | null>(null);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly searchQuery = signal('');
  readonly filterType = signal<'ALL' | 'PORCENTAJE' | 'MONTO_FIJO' | 'DOS_POR_UNO' | 'COMPRA_MINIMA'>('ALL');
  readonly filterActive = signal<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  readonly modalOpen = signal(false);
  readonly editingPromotion = signal<Promotion | null>(null);
  readonly promoScope = signal<'CUPON' | 'PRENDA'>('CUPON');

  setPromoScope(scope: 'CUPON' | 'PRENDA'): void {
    this.promoScope.set(scope);
    if (scope === 'PRENDA' && !this.editingPromotion()) {
      const autoCode = `DIRECTA-${Math.floor(1000 + Math.random() * 9000)}`;
      this.promoForm.patchValue({ codigo: autoCode });
    }
  }

  isDirectPromo(promo: Promotion): boolean {
    const c = (promo.codigo || '').toUpperCase();
    return (
      !!promo.producto_id ||
      c.startsWith('DIRECTA-') ||
      c.startsWith('OFERTA-') ||
      c.startsWith('PRENDA-') ||
      (promo.descripcion || '').toLowerCase().includes('prenda')
    );
  }

  selectGarment(prodIdStr: any): void {
    const id = prodIdStr ? Number(prodIdStr) : null;
    const prod = id ? (this.availableProducts().find(p => p.id === id) || null) : null;
    this.selectedGarment.set(prod);
    this.promoForm.patchValue({ producto_id: id });
    if (prod && this.promoScope() === 'PRENDA' && !this.editingPromotion()) {
      const code = `OFERTA-${prod.id}`;
      this.promoForm.patchValue({
        codigo: code,
        descripcion: `Descuento exclusivo en ${prod.nombre}`,
      });
    }
  }

  // Simulador de cupones
  readonly testCode = signal('');
  readonly testSubtotal = signal<number>(250);
  readonly testTesting = signal(false);
  readonly testResult = signal<{
    valido: boolean;
    mensaje: string;
    descuento_calculado: number;
    finalTotal: number;
  } | null>(null);

  promoForm!: FormGroup;

  readonly filteredPromotions = computed(() => {
    let list = this.promotions();
    const q = this.searchQuery().trim().toLowerCase();
    const type = this.filterType();
    const active = this.filterActive();

    if (q) {
      list = list.filter(
        (p) =>
          p.codigo.toLowerCase().includes(q) ||
          (p.descripcion && p.descripcion.toLowerCase().includes(q)),
      );
    }

    if (type !== 'ALL') {
      list = list.filter((p) => p.tipo_descuento === type);
    }

    if (active === 'ACTIVE') {
      list = list.filter((p) => p.activo);
    } else if (active === 'INACTIVE') {
      list = list.filter((p) => !p.activo);
    }

    return list;
  });

  readonly stats = computed(() => {
    const list = this.promotions();
    const total = list.length;
    const activas = list.filter((p) => p.activo).length;
    const totalUsos = list.reduce((acc, p) => acc + (p.usos_actuales || 0), 0);
    return { total, activas, totalUsos };
  });

  ngOnInit(): void {
    this.initForm();
    this.loadPromotions();
    this.loadProducts();
  }

  loadProducts(): void {
    this.adminApi.listProducts({ limit: 100 }).subscribe({
      next: (prods: Product[]) => this.availableProducts.set(prods || []),
      error: () => {},
    });
  }

  private initForm(): void {
    this.promoForm = this.fb.group({
      codigo: ['', [Validators.required, Validators.pattern(/^[A-Z0-9_-]{3,50}$/)]],
      descripcion: ['', [Validators.maxLength(255)]],
      tipo_descuento: ['PORCENTAJE', [Validators.required]],
      valor_descuento: [10, [Validators.required, Validators.min(0.01)]],
      monto_minimo_compra: [0, [Validators.min(0)]],
      fecha_inicio: [null],
      fecha_fin: [null],
      limite_usos: [null, [Validators.min(1)]],
      producto_id: [null],
      activo: [true],
    });
  }

  copyPromoCode(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.toasts.show(`¡Código "${code}" copiado al portapapeles! Puedes pegarlo en el carrito.`, 'success');
    }).catch(() => {
      this.toasts.show(`Código: ${code}`, 'info');
    });
  }

  loadPromotions(): void {
    this.loading.set(true);
    this.adminApi.listPromotions().subscribe({
      next: (data) => {
        this.promotions.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.toasts.show('Error al cargar promociones: ' + (err.error?.detail || err.message), 'error');
        this.loading.set(false);
      },
    });
  }

  openCreateModal(): void {
    this.editingPromotion.set(null);
    this.selectedGarment.set(null);
    this.promoScope.set('CUPON');
    this.promoForm.reset({
      codigo: '',
      descripcion: '',
      tipo_descuento: 'PORCENTAJE',
      valor_descuento: 15,
      monto_minimo_compra: 0,
      fecha_inicio: null,
      fecha_fin: null,
      limite_usos: null,
      producto_id: null,
      activo: true,
    });
    this.modalOpen.set(true);
  }

  openEditModal(promo: Promotion): void {
    this.editingPromotion.set(promo);
    const linkedProd = promo.producto_id
      ? (this.availableProducts().find((p) => p.id === promo.producto_id) || null)
      : null;
    this.selectedGarment.set(linkedProd);
    this.promoScope.set(this.isDirectPromo(promo) || !!promo.producto_id ? 'PRENDA' : 'CUPON');
    this.promoForm.patchValue({
      codigo: promo.codigo,
      descripcion: promo.descripcion || '',
      tipo_descuento: promo.tipo_descuento,
      valor_descuento: promo.valor_descuento,
      monto_minimo_compra: promo.monto_minimo_compra,
      fecha_inicio: promo.fecha_inicio ? promo.fecha_inicio.substring(0, 10) : null,
      fecha_fin: promo.fecha_fin ? promo.fecha_fin.substring(0, 10) : null,
      limite_usos: promo.limite_usos,
      producto_id: promo.producto_id || null,
      activo: promo.activo,
    });
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editingPromotion.set(null);
    this.selectedGarment.set(null);
  }

  savePromotion(): void {
    if (this.promoForm.invalid) {
      this.promoForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const formVal = this.promoForm.value;
    const payload: PromotionInput = {
      codigo: formVal.codigo.trim().toUpperCase(),
      descripcion: formVal.descripcion ? formVal.descripcion.trim() : null,
      tipo_descuento: formVal.tipo_descuento,
      valor_descuento: Number(formVal.valor_descuento),
      monto_minimo_compra: Number(formVal.monto_minimo_compra || 0),
      fecha_inicio: formVal.fecha_inicio ? new Date(formVal.fecha_inicio).toISOString() : null,
      fecha_fin: formVal.fecha_fin ? new Date(formVal.fecha_fin).toISOString() : null,
      limite_usos: formVal.limite_usos ? Number(formVal.limite_usos) : null,
      producto_id: formVal.producto_id ? Number(formVal.producto_id) : null,
      activo: !!formVal.activo,
    };

    const current = this.editingPromotion();
    if (current) {
      this.adminApi.updatePromotion(current.id, payload).subscribe({
        next: (updated) => {
          this.promotions.update((list) =>
            list.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.toasts.show(`Promoción "${updated.codigo}" actualizada con éxito.`, 'success');
          this.submitting.set(false);
          this.closeModal();
        },
        error: (err) => {
          this.toasts.show('Error al actualizar promoción: ' + (err.error?.detail || err.message), 'error');
          this.submitting.set(false);
        },
      });
    } else {
      this.adminApi.createPromotion(payload).subscribe({
        next: (created) => {
          this.promotions.update((list) => [created, ...list]);
          this.toasts.show(`Promoción "${created.codigo}" creada con éxito.`, 'success');
          this.submitting.set(false);
          this.closeModal();
        },
        error: (err) => {
          this.toasts.show('Error al crear promoción: ' + (err.error?.detail || err.message), 'error');
          this.submitting.set(false);
        },
      });
    }
  }

  togglePromotionStatus(promo: Promotion): void {
    const payload: PromotionInput = {
      codigo: promo.codigo,
      descripcion: promo.descripcion,
      tipo_descuento: promo.tipo_descuento,
      valor_descuento: promo.valor_descuento,
      monto_minimo_compra: promo.monto_minimo_compra,
      fecha_inicio: promo.fecha_inicio,
      fecha_fin: promo.fecha_fin,
      limite_usos: promo.limite_usos,
      activo: !promo.activo,
    };

    this.adminApi.updatePromotion(promo.id, payload).subscribe({
      next: (updated) => {
        this.promotions.update((list) =>
          list.map((p) => (p.id === updated.id ? updated : p)),
        );
        const st = updated.activo ? 'activada' : 'desactivada';
        this.toasts.show(`Promoción "${updated.codigo}" ${st}.`, 'success');
      },
      error: (err) => {
        this.toasts.show('Error al alternar estado: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  deletePromotion(promo: Promotion): void {
    const confirmed = window.confirm(
      `¿Desea eliminar la regla de promoción "${promo.codigo}"?`,
    );
    if (!confirmed) return;

    this.adminApi.deletePromotion(promo.id).subscribe({
      next: () => {
        this.promotions.update((list) => list.filter((p) => p.id !== promo.id));
        this.toasts.show(`Promoción "${promo.codigo}" eliminada.`, 'success');
      },
      error: (err) => {
        this.toasts.show('Error al eliminar promoción: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  // Simulador de Descuento
  testPromotion(): void {
    const code = this.testCode().trim();
    const subtotal = Number(this.testSubtotal());

    if (!code) {
      this.toasts.show('Introduce un código para simular la regla.', 'info');
      return;
    }

    this.testTesting.set(true);
    this.adminApi.validatePromotion(code, subtotal).subscribe({
      next: (res) => {
        const desc = Number(res.descuento_calculado || 0);
        const finalTot = Math.max(0, subtotal - desc);
        this.testResult.set({
          valido: res.valido,
          mensaje: res.mensaje,
          descuento_calculado: desc,
          finalTotal: finalTot,
        });
        this.testTesting.set(false);
      },
      error: (err) => {
        this.testResult.set({
          valido: false,
          mensaje: err.error?.detail || 'Error al validar cupón',
          descuento_calculado: 0,
          finalTotal: subtotal,
        });
        this.testTesting.set(false);
      },
    });
  }
}
