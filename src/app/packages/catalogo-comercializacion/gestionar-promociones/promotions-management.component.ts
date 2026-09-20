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
  readonly scopeTarget = signal<'ALL' | 'GARMENT'>('ALL');

  setScopeTarget(target: 'ALL' | 'GARMENT'): void {
    this.scopeTarget.set(target);
    if (target === 'ALL') {
      this.selectedGarment.set(null);
      this.promoForm.patchValue({ producto_id: null });
    }
  }

  isDirectPromo(promo: Promotion): boolean {
    return !!promo.producto_id;
  }

  selectGarment(prodIdStr: any): void {
    const id = prodIdStr ? Number(prodIdStr) : null;
    const prod = id ? (this.availableProducts().find((p) => p.id === id) || null) : null;
    this.selectedGarment.set(prod);
    this.promoForm.patchValue({ producto_id: id });
  }

  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cleaned = (input.value || '')
      .toUpperCase()
      .replace(/\s+/g, '-')
      .replace(/[^A-Z0-9_-]/g, '');
    input.value = cleaned;
    this.promoForm.patchValue({ codigo: cleaned });
  }

  generatePromoCode(): void {
    const prefixes = ['ATELIER', 'PROMO', 'ESTILO', 'VIP', 'MODA', 'ESPECIAL'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(10 + Math.random() * 89);
    const code = `${prefix}-${num}`;
    this.promoForm.patchValue({ codigo: code });
    this.toasts.show(`Código generado: ${code}`, 'info');
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
      codigo: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      descripcion: ['', [Validators.maxLength(255)]],
      tipo_descuento: ['PORCENTAJE', [Validators.required]],
      valor_descuento: [15, [Validators.required, Validators.min(0.01)]],
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
      this.toasts.show(`¡Código "${code}" copiado al portapapeles!`, 'success');
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
    this.scopeTarget.set('ALL');
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
    this.scopeTarget.set(promo.producto_id ? 'GARMENT' : 'ALL');
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

  private formatPayloadDate(dateStr: string | null | undefined, isEndOfDay = false): string | null {
    if (!dateStr || typeof dateStr !== 'string' || !dateStr.trim()) return null;
    const clean = dateStr.trim();
    try {
      if (clean.length === 10) {
        const [year, month, day] = clean.split('-').map(Number);
        if (!year || !month || !day) return null;
        const d = new Date(Date.UTC(year, month - 1, day, isEndOfDay ? 23 : 0, isEndOfDay ? 59 : 0, isEndOfDay ? 59 : 0));
        return d.toISOString();
      }
      const d = new Date(clean);
      return isNaN(d.getTime()) ? null : d.toISOString();
    } catch {
      return null;
    }
  }

  savePromotion(): void {
    const rawCode = (this.promoForm.value.codigo || '').trim();
    if (!rawCode) {
      this.toasts.show('Por favor introduce un código para la promoción (ej. ATELIER15).', 'error');
      this.promoForm.get('codigo')?.markAsTouched();
      return;
    }
    const val = Number(this.promoForm.value.valor_descuento);
    if (!val || val <= 0) {
      this.toasts.show('El valor del descuento debe ser mayor a 0.', 'error');
      this.promoForm.get('valor_descuento')?.markAsTouched();
      return;
    }

    if (this.promoForm.invalid) {
      this.promoForm.markAllAsTouched();
      this.toasts.show('Verifica los campos obligatorios del formulario.', 'error');
      return;
    }

    this.submitting.set(true);
    const formVal = this.promoForm.value;
    const cleanCode = rawCode.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9_-]/g, '');

    const payload: PromotionInput = {
      codigo: cleanCode,
      descripcion: formVal.descripcion ? formVal.descripcion.trim() : null,
      tipo_descuento: formVal.tipo_descuento,
      valor_descuento: val,
      monto_minimo_compra: Number(formVal.monto_minimo_compra || 0),
      fecha_inicio: this.formatPayloadDate(formVal.fecha_inicio, false),
      fecha_fin: this.formatPayloadDate(formVal.fecha_fin, true),
      limite_usos: formVal.limite_usos ? Number(formVal.limite_usos) : null,
      producto_id: this.scopeTarget() === 'GARMENT' && formVal.producto_id ? Number(formVal.producto_id) : null,
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
