import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApiService } from '@core/api/admin-api.service';
import { AuthService } from '@core/auth.service';
import { Supplier, SupplierInput, SupplierProduct, SupplierProductInput } from '@core/models';
import { ToastService } from '@core/toast.service';

@Component({
  selector: 'app-suppliers-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './suppliers-management.component.html',
  styleUrl: './suppliers-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuppliersManagementComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);

  readonly isSupplierUser = computed(() => this.auth.user()?.rol === 'PROVEEDOR');
  readonly mySupplierProfile = signal<Supplier | null>(null);

  // CU-32: Proveedores base
  readonly suppliers = signal<Supplier[]>([]);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly searchQuery = signal('');
  readonly filterCity = signal('TODAS');
  readonly filterActive = signal<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  readonly modalOpen = signal(false);
  readonly editingSupplier = signal<Supplier | null>(null);

  supplierForm!: FormGroup;

  // CU-33: Cuentas de acceso de proveedor
  readonly accountModalOpen = signal(false);
  readonly accountSupplier = signal<Supplier | null>(null);
  readonly submittingAccount = signal(false);
  accountForm!: FormGroup;

  // CU-33: Catalogo e insumos de proveedor
  readonly suppliesModalOpen = signal(false);
  readonly selectedSupplier = signal<Supplier | null>(null);
  readonly supplierProducts = signal<SupplierProduct[]>([]);
  readonly loadingSupplies = signal(false);
  readonly submittingSupply = signal(false);
  readonly showAddSupplyForm = signal(false);
  readonly editingSupply = signal<SupplierProduct | null>(null);
  readonly mySupplierSearch = signal('');

  readonly filteredSupplierProducts = computed(() => {
    let list = this.supplierProducts();
    const q = this.mySupplierSearch().trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.nombre_suministro.toLowerCase().includes(q) ||
        (p.sku_proveedor && p.sku_proveedor.toLowerCase().includes(q)) ||
        p.categoria.toLowerCase().includes(q) ||
        p.estado.toLowerCase().includes(q),
    );
  });

  readonly mySupplierStats = computed(() => {
    const list = this.supplierProducts();
    const total = list.length;
    const totalStock = list.reduce((acc, p) => acc + (p.cantidad_disponible || 0), 0);
    const disponibles = list.filter((p) => p.estado === 'DISPONIBLE').length;
    return { total, totalStock, disponibles };
  });

  supplyForm!: FormGroup;

  readonly availableCities = ['La Paz', 'Santa Cruz', 'Cochabamba', 'Oruro', 'Sucre', 'Tarija', 'Potosi'];
  readonly supplyCategories = [
    'Prendas y Confeccion Textil',
    'Telas y Confeccion',
    'Lana de Alpaca y Cachemira',
    'Lino 100% y Algodon Pima',
    'Seda Natural y Brocados',
    'Merceria, Botones y Cremalleras',
    'Hilos y Avios de Sastreria',
    'Cuero y Herrajes',
  ];

  readonly supplyCategoriesForProduct = [
    'Prendas y Confeccion',
    'Telas y Tejidos',
    'Lana y Fibras',
    'Hilos de Sastreria',
    'Herrajes y Metales',
    'Botones y Cierres',
    'Forreria y Entretelas',
    'Empaque y Cajas',
    'Tintes y Acabados',
  ];

  readonly unitsOfMeasure = [
    'Unidades',
    'Prendas',
    'Metros',
    'Yardas',
    'Kilogramos',
    'Rollos',
    'Conos',
    'Docenas',
    'Paquetes',
  ];

  readonly supplyStatuses: Array<'DISPONIBLE' | 'BAJO_PEDIDO' | 'AGOTADO'> = [
    'DISPONIBLE',
    'BAJO_PEDIDO',
    'AGOTADO',
  ];

  readonly filteredSuppliers = computed(() => {
    let list = this.suppliers();
    const q = this.searchQuery().trim().toLowerCase();
    const city = this.filterCity();
    const active = this.filterActive();

    if (q) {
      list = list.filter(
        (s) =>
          s.nombre_empresa.toLowerCase().includes(q) ||
          (s.nit && s.nit.toLowerCase().includes(q)) ||
          (s.contacto_nombre && s.contacto_nombre.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q)) ||
          s.categoria_suministro.toLowerCase().includes(q),
      );
    }

    if (city !== 'TODAS') {
      list = list.filter((s) => s.ciudad.toLowerCase() === city.toLowerCase());
    }

    if (active === 'ACTIVE') {
      list = list.filter((s) => s.activo);
    } else if (active === 'INACTIVE') {
      list = list.filter((s) => !s.activo);
    }

    return list;
  });

  readonly stats = computed(() => {
    const list = this.suppliers();
    const total = list.length;
    const activos = list.filter((s) => s.activo).length;
    const ciudades = new Set(list.map((s) => s.ciudad)).size;
    return { total, activos, ciudades };
  });

  ngOnInit(): void {
    this.initForm();
    this.initSupplyForm();
    this.initAccountForm();
    if (this.isSupplierUser()) {
      this.loadMySupplierData();
    } else {
      this.loadSuppliers();
    }
  }

  private initAccountForm(): void {
    this.accountForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
      password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(100)]],
      nombre: ['', [Validators.maxLength(120)]],
    });
  }

  loadMySupplierData(): void {
    this.loading.set(true);
    this.adminApi.getMySupplierProfile().subscribe({
      next: (sup) => {
        this.mySupplierProfile.set(sup);
        this.selectedSupplier.set(sup);
        this.loadSupplies(sup.id);
        this.loading.set(false);
      },
      error: (err) => {
        this.toasts.show('Perfil de proveedor: ' + (err.error?.detail || err.message), 'info');
        this.loading.set(false);
      },
    });
  }

  private initForm(): void {
    this.supplierForm = this.fb.group({
      nombre_empresa: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
      nit: ['', [Validators.maxLength(50)]],
      contacto_nombre: ['', [Validators.maxLength(120)]],
      telefono: ['', [Validators.maxLength(50)]],
      email: ['', [Validators.email, Validators.maxLength(150)]],
      ciudad: ['La Paz', [Validators.required]],
      direccion: ['', [Validators.maxLength(250)]],
      categoria_suministro: ['Telas y Confeccion', [Validators.required]],
      activo: [true],
    });
  }

  private initSupplyForm(): void {
    this.supplyForm = this.fb.group({
      nombre_suministro: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
      sku_proveedor: ['', [Validators.maxLength(60)]],
      categoria: ['Telas y Tejidos', [Validators.required]],
      unidad_medida: ['Metros', [Validators.required]],
      costo_unitario: [0, [Validators.required, Validators.min(0.01)]],
      cantidad_disponible: [0, [Validators.required, Validators.min(0)]],
      tiempo_entrega_dias: [3, [Validators.required, Validators.min(1)]],
      estado: ['DISPONIBLE', [Validators.required]],
      activo: [true],
    });
  }

  loadSuppliers(): void {
    this.loading.set(true);
    this.adminApi.listSuppliers().subscribe({
      next: (data) => {
        this.suppliers.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.toasts.show('Error al cargar proveedores: ' + (err.error?.detail || err.message), 'error');
        this.loading.set(false);
      },
    });
  }

  openCreateModal(): void {
    this.editingSupplier.set(null);
    this.supplierForm.reset({
      nombre_empresa: '',
      nit: '',
      contacto_nombre: '',
      telefono: '',
      email: '',
      ciudad: 'La Paz',
      direccion: '',
      categoria_suministro: 'Telas y Confeccion',
      activo: true,
    });
    this.modalOpen.set(true);
  }

  openEditModal(supplier: Supplier): void {
    this.editingSupplier.set(supplier);
    this.supplierForm.patchValue({
      nombre_empresa: supplier.nombre_empresa,
      nit: supplier.nit || '',
      contacto_nombre: supplier.contacto_nombre || '',
      telefono: supplier.telefono || '',
      email: supplier.email || '',
      ciudad: supplier.ciudad,
      direccion: supplier.direccion || '',
      categoria_suministro: supplier.categoria_suministro,
      activo: supplier.activo,
    });
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editingSupplier.set(null);
  }

  saveSupplier(): void {
    if (this.supplierForm.invalid) {
      this.supplierForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const formVal = this.supplierForm.value;
    const payload: SupplierInput = {
      nombre_empresa: formVal.nombre_empresa,
      nit: formVal.nit ? formVal.nit.trim() : null,
      contacto_nombre: formVal.contacto_nombre ? formVal.contacto_nombre.trim() : null,
      telefono: formVal.telefono ? formVal.telefono.trim() : null,
      email: formVal.email ? formVal.email.trim() : null,
      ciudad: formVal.ciudad,
      direccion: formVal.direccion ? formVal.direccion.trim() : null,
      categoria_suministro: formVal.categoria_suministro,
      activo: formVal.activo,
    };

    const current = this.editingSupplier();
    if (current) {
      this.adminApi.updateSupplier(current.id, payload).subscribe({
        next: (updated) => {
          this.suppliers.update((list) =>
            list.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.toasts.show(`Proveedor "${updated.nombre_empresa}" actualizado con exito.`, 'success');
          this.submitting.set(false);
          this.closeModal();
        },
        error: (err) => {
          this.toasts.show('Error al actualizar proveedor: ' + (err.error?.detail || err.message), 'error');
          this.submitting.set(false);
        },
      });
    } else {
      this.adminApi.createSupplier(payload).subscribe({
        next: (created) => {
          this.suppliers.update((list) => [created, ...list]);
          this.toasts.show(`Proveedor "${created.nombre_empresa}" registrado con exito.`, 'success');
          this.submitting.set(false);
          this.closeModal();
        },
        error: (err) => {
          this.toasts.show('Error al registrar proveedor: ' + (err.error?.detail || err.message), 'error');
          this.submitting.set(false);
        },
      });
    }
  }

  toggleSupplierStatus(supplier: Supplier): void {
    const payload: SupplierInput = {
      nombre_empresa: supplier.nombre_empresa,
      nit: supplier.nit,
      contacto_nombre: supplier.contacto_nombre,
      telefono: supplier.telefono,
      email: supplier.email,
      ciudad: supplier.ciudad,
      direccion: supplier.direccion,
      categoria_suministro: supplier.categoria_suministro,
      activo: !supplier.activo,
    };

    this.adminApi.updateSupplier(supplier.id, payload).subscribe({
      next: (updated) => {
        this.suppliers.update((list) =>
          list.map((s) => (s.id === updated.id ? updated : s)),
        );
        const estadoStr = updated.activo ? 'activado' : 'desactivado';
        this.toasts.show(`Proveedor "${updated.nombre_empresa}" ${estadoStr}.`, 'success');
      },
      error: (err) => {
        this.toasts.show('Error al cambiar estado: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  deleteSupplier(supplier: Supplier): void {
    const confirmDelete = window.confirm(
      `Desea eliminar definitivamente al proveedor "${supplier.nombre_empresa}"?`,
    );
    if (!confirmDelete) return;

    this.adminApi.deleteSupplier(supplier.id).subscribe({
      next: () => {
        this.suppliers.update((list) => list.filter((s) => s.id !== supplier.id));
        this.toasts.show(`Proveedor "${supplier.nombre_empresa}" eliminado.`, 'success');
      },
      error: (err) => {
        this.toasts.show('Error al eliminar proveedor: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  // ==========================================
  // CU-33: Cuentas de Acceso de Proveedor
  // ==========================================
  openAccountModal(supplier: Supplier): void {
    this.accountSupplier.set(supplier);
    this.accountForm.reset({
      email: supplier.email || '',
      password: '',
      nombre: supplier.contacto_nombre || supplier.nombre_empresa || '',
    });
    this.accountModalOpen.set(true);
  }

  closeAccountModal(): void {
    this.accountModalOpen.set(false);
    this.accountSupplier.set(null);
  }

  saveSupplierAccount(): void {
    const supplier = this.accountSupplier();
    if (!supplier) return;

    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      return;
    }

    this.submittingAccount.set(true);
    const formVal = this.accountForm.value;
    this.adminApi
      .createSupplierAccount(supplier.id, {
        email: formVal.email.trim(),
        password: formVal.password,
        nombre: formVal.nombre ? formVal.nombre.trim() : undefined,
      })
      .subscribe({
        next: (updated) => {
          this.suppliers.update((list) =>
            list.map((s) => (s.id === updated.id ? updated : s)),
          );
          this.toasts.show(`Cuenta de acceso vinculada a "${updated.nombre_empresa}".`, 'success');
          this.submittingAccount.set(false);
          this.closeAccountModal();
        },
        error: (err) => {
          this.toasts.show('Error al vincular cuenta: ' + (err.error?.detail || err.message), 'error');
          this.submittingAccount.set(false);
        },
      });
  }

  unlinkSupplierAccount(supplier: Supplier): void {
    const confirmed = window.confirm(`Desea desvincular la cuenta de acceso de "${supplier.nombre_empresa}"?`);
    if (!confirmed) return;

    this.adminApi.unlinkSupplierAccount(supplier.id).subscribe({
      next: (updated) => {
        this.suppliers.update((list) =>
          list.map((s) => (s.id === updated.id ? updated : s)),
        );
        this.toasts.show(`Cuenta desvinculada de "${supplier.nombre_empresa}".`, 'info');
      },
      error: (err) => {
        this.toasts.show('Error al desvincular cuenta: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  // ==========================================
  // CU-33: Catalogo de Suministros por Proveedor
  // ==========================================
  openSuppliesModal(supplier: Supplier): void {
    this.selectedSupplier.set(supplier);
    this.suppliesModalOpen.set(true);
    this.showAddSupplyForm.set(false);
    this.editingSupply.set(null);
    this.loadSupplies(supplier.id);
  }

  closeSuppliesModal(): void {
    this.suppliesModalOpen.set(false);
    this.selectedSupplier.set(null);
    this.supplierProducts.set([]);
    this.showAddSupplyForm.set(false);
    this.editingSupply.set(null);
  }

  loadSupplies(supplierId: number): void {
    this.loadingSupplies.set(true);
    this.adminApi.listSupplierProducts(supplierId).subscribe({
      next: (products) => {
        this.supplierProducts.set(products);
        this.loadingSupplies.set(false);
      },
      error: (err) => {
        this.toasts.show('Error al cargar catalogo de insumos: ' + (err.error?.detail || err.message), 'error');
        this.loadingSupplies.set(false);
      },
    });
  }

  openCreateSupply(): void {
    if (this.isSupplierUser() && !this.selectedSupplier()) {
      this.selectedSupplier.set(this.mySupplierProfile());
    }
    this.editingSupply.set(null);
    this.supplyForm.reset({
      nombre_suministro: '',
      sku_proveedor: '',
      categoria: 'Telas y Tejidos',
      unidad_medida: 'Metros',
      costo_unitario: 0,
      cantidad_disponible: 0,
      tiempo_entrega_dias: 3,
      estado: 'DISPONIBLE',
      activo: true,
    });
    this.showAddSupplyForm.set(true);
    if (this.isSupplierUser()) {
      this.suppliesModalOpen.set(true);
    }
  }

  openEditSupply(item: SupplierProduct): void {
    if (this.isSupplierUser() && !this.selectedSupplier()) {
      this.selectedSupplier.set(this.mySupplierProfile());
    }
    this.editingSupply.set(item);
    this.supplyForm.patchValue({
      nombre_suministro: item.nombre_suministro,
      sku_proveedor: item.sku_proveedor || '',
      categoria: item.categoria,
      unidad_medida: item.unidad_medida,
      costo_unitario: item.costo_unitario,
      cantidad_disponible: item.cantidad_disponible,
      tiempo_entrega_dias: item.tiempo_entrega_dias,
      estado: item.estado,
      activo: item.activo,
    });
    this.showAddSupplyForm.set(true);
    if (this.isSupplierUser()) {
      this.suppliesModalOpen.set(true);
    }
  }

  cancelSupplyForm(): void {
    this.showAddSupplyForm.set(false);
    this.editingSupply.set(null);
  }

  saveSupply(): void {
    const supplier = this.selectedSupplier() || this.mySupplierProfile();
    if (!supplier && !this.isSupplierUser()) return;

    if (this.supplyForm.invalid) {
      this.supplyForm.markAllAsTouched();
      return;
    }

    this.submittingSupply.set(true);
    const formVal = this.supplyForm.value;
    const payload: SupplierProductInput = {
      nombre_suministro: formVal.nombre_suministro.trim(),
      sku_proveedor: formVal.sku_proveedor ? formVal.sku_proveedor.trim() : null,
      categoria: formVal.categoria,
      unidad_medida: formVal.unidad_medida,
      costo_unitario: Number(formVal.costo_unitario),
      cantidad_disponible: Number(formVal.cantidad_disponible),
      tiempo_entrega_dias: Number(formVal.tiempo_entrega_dias),
      estado: formVal.estado,
      activo: formVal.activo,
    };

    const currentSupply = this.editingSupply();

    if (this.isSupplierUser()) {
      if (currentSupply) {
        this.adminApi.updateMySupplierProduct(currentSupply.id, payload).subscribe({
          next: (updated) => {
            this.supplierProducts.update((list) =>
              list.map((item) => (item.id === updated.id ? updated : item)),
            );
            this.toasts.show(`Prenda/Insumo "${updated.nombre_suministro}" actualizado correctamente.`, 'success');
            this.submittingSupply.set(false);
            this.showAddSupplyForm.set(false);
            this.editingSupply.set(null);
            this.suppliesModalOpen.set(false);
          },
          error: (err) => {
            this.toasts.show('Error al actualizar: ' + (err.error?.detail || err.message), 'error');
            this.submittingSupply.set(false);
          },
        });
      } else {
        this.adminApi.createMySupplierProduct(payload).subscribe({
          next: (created) => {
            this.supplierProducts.update((list) => [created, ...list]);
            this.toasts.show(`Prenda/Insumo "${created.nombre_suministro}" agregado a tu catalogo.`, 'success');
            this.submittingSupply.set(false);
            this.showAddSupplyForm.set(false);
            this.suppliesModalOpen.set(false);
          },
          error: (err) => {
            this.toasts.show('Error al registrar prenda/insumo: ' + (err.error?.detail || err.message), 'error');
            this.submittingSupply.set(false);
          },
        });
      }
      return;
    }

    if (!supplier) {
      this.submittingSupply.set(false);
      return;
    }

    if (currentSupply) {
      this.adminApi.updateSupplierProduct(supplier.id, currentSupply.id, payload).subscribe({
        next: (updated) => {
          this.supplierProducts.update((list) =>
            list.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.toasts.show(`Insumo "${updated.nombre_suministro}" actualizado.`, 'success');
          this.submittingSupply.set(false);
          this.showAddSupplyForm.set(false);
          this.editingSupply.set(null);
        },
        error: (err) => {
          this.toasts.show('Error al actualizar insumo: ' + (err.error?.detail || err.message), 'error');
          this.submittingSupply.set(false);
        },
      });
    } else {
      this.adminApi.createSupplierProduct(supplier.id, payload).subscribe({
        next: (created) => {
          this.supplierProducts.update((list) => [created, ...list]);
          this.toasts.show(`Insumo "${created.nombre_suministro}" registrado en el catalogo.`, 'success');
          this.submittingSupply.set(false);
          this.showAddSupplyForm.set(false);
        },
        error: (err) => {
          this.toasts.show('Error al registrar insumo: ' + (err.error?.detail || err.message), 'error');
          this.submittingSupply.set(false);
        },
      });
    }
  }

  deleteSupply(item: SupplierProduct): void {
    const confirmed = window.confirm(`Desea eliminar "${item.nombre_suministro}" del catalogo?`);
    if (!confirmed) return;

    if (this.isSupplierUser()) {
      this.adminApi.deleteMySupplierProduct(item.id).subscribe({
        next: () => {
          this.supplierProducts.update((list) => list.filter((i) => i.id !== item.id));
          this.toasts.show(`Prenda "${item.nombre_suministro}" eliminada de tu catalogo.`, 'success');
        },
        error: (err) => {
          this.toasts.show('Error al eliminar prenda: ' + (err.error?.detail || err.message), 'error');
        },
      });
      return;
    }

    const supplier = this.selectedSupplier();
    if (!supplier) return;

    this.adminApi.deleteSupplierProduct(supplier.id, item.id).subscribe({
      next: () => {
        this.supplierProducts.update((list) => list.filter((i) => i.id !== item.id));
        this.toasts.show(`Insumo "${item.nombre_suministro}" eliminado del catalogo.`, 'success');
      },
      error: (err) => {
        this.toasts.show('Error al eliminar insumo: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }
}
