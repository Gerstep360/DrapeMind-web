import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApiService } from '@core/api/admin-api.service';
import { ToastService } from '@core/toast.service';
import { Branch, City } from '@core/models';

@Component({
  selector: 'app-branches-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './branches-management.component.html',
  styleUrl: './branches-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchesManagementComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);

  readonly activeTab = signal<'branches' | 'cities'>('branches');
  readonly branches = signal<Branch[]>([]);
  readonly cities = signal<City[]>([]);
  readonly loading = signal(false);
  readonly searchQuery = signal('');
  readonly filterCityId = signal<number | null>(null);

  // Modal states
  readonly branchModalOpen = signal(false);
  readonly editingBranch = signal<Branch | null>(null);
  readonly cityModalOpen = signal(false);
  readonly editingCity = signal<City | null>(null);

  branchForm!: FormGroup;
  cityForm!: FormGroup;

  ngOnInit(): void {
    this.initForms();
    this.loadData();
  }

  private initForms(): void {
    this.branchForm = this.fb.group({
      codigo: ['', [Validators.required, Validators.pattern(/^[A-Z0-9-]+$/)]],
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      ciudad_id: [null, [Validators.required]],
      direccion: ['', [Validators.required, Validators.minLength(5)]],
      telefono: [''],
      latitud: [null],
      longitud: [null],
      activo: [true],
    });

    this.cityForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      departamento: ['', [Validators.required, Validators.minLength(2)]],
      activo: [true],
    });
  }

  loadData(): void {
    this.loading.set(true);
    this.adminApi.listCities(true).subscribe({
      next: (cities) => {
        this.cities.set(cities);
        this.adminApi.listBranches(true).subscribe({
          next: (branches) => {
            this.branches.set(branches);
            this.loading.set(false);
          },
          error: (err) => {
            this.toasts.show('Error al cargar sucursales: ' + (err.error?.detail || err.message), 'error');
            this.loading.set(false);
          },
        });
      },
      error: (err) => {
        this.toasts.show('Error al cargar ciudades: ' + (err.error?.detail || err.message), 'error');
        this.loading.set(false);
      },
    });
  }

  filteredBranches(): Branch[] {
    const q = this.searchQuery().trim().toLowerCase();
    const cityId = this.filterCityId();
    return this.branches().filter((b) => {
      const matchCity = cityId === null || b.ciudad_id === cityId;
      const matchQ =
        !q ||
        b.nombre.toLowerCase().includes(q) ||
        b.codigo.toLowerCase().includes(q) ||
        (b.direccion && b.direccion.toLowerCase().includes(q)) ||
        (b.ciudad && b.ciudad.toLowerCase().includes(q));
      return matchCity && matchQ;
    });
  }

  filteredCities(): City[] {
    const q = this.searchQuery().trim().toLowerCase();
    return this.cities().filter((c) => {
      return !q || c.nombre.toLowerCase().includes(q) || c.departamento.toLowerCase().includes(q);
    });
  }

  openNewBranchModal(): void {
    this.editingBranch.set(null);
    this.branchForm.reset({
      codigo: '',
      nombre: '',
      ciudad_id: this.cities().length > 0 ? this.cities()[0].id : null,
      direccion: '',
      telefono: '',
      latitud: null,
      longitud: null,
      activo: true,
    });
    this.branchModalOpen.set(true);
  }

  openEditBranchModal(branch: Branch): void {
    this.editingBranch.set(branch);
    this.branchForm.patchValue({
      codigo: branch.codigo,
      nombre: branch.nombre,
      ciudad_id: branch.ciudad_id,
      direccion: branch.direccion,
      telefono: branch.telefono || '',
      latitud: branch.latitud,
      longitud: branch.longitud,
      activo: branch.activo,
    });
    this.branchModalOpen.set(true);
  }

  closeBranchModal(): void {
    this.branchModalOpen.set(false);
  }

  saveBranch(): void {
    if (this.branchForm.invalid) {
      this.branchForm.markAllAsTouched();
      return;
    }
    const val = this.branchForm.value;
    const editing = this.editingBranch();

    if (editing) {
      this.adminApi.updateBranch(editing.id, val).subscribe({
        next: () => {
          this.toasts.show(`Sucursal "${val.nombre}" actualizada con éxito`, 'info');
          this.closeBranchModal();
          this.loadData();
        },
        error: (err) => {
          this.toasts.show('Error al actualizar sucursal: ' + (err.error?.detail || err.message), 'error');
        },
      });
    } else {
      this.adminApi.createBranch(val).subscribe({
        next: () => {
          this.toasts.show(`Sucursal "${val.nombre}" creada con éxito`, 'info');
          this.closeBranchModal();
          this.loadData();
        },
        error: (err) => {
          this.toasts.show('Error al registrar sucursal: ' + (err.error?.detail || err.message), 'error');
        },
      });
    }
  }

  toggleBranchStatus(branch: Branch): void {
    this.adminApi.deleteBranch(branch.id).subscribe({
      next: (res) => {
        this.toasts.show(res.message || 'Estado actualizado', 'info');
        this.loadData();
      },
      error: (err) => {
        this.toasts.show('Error al cambiar estado: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  openNewCityModal(): void {
    this.editingCity.set(null);
    this.cityForm.reset({
      nombre: '',
      departamento: '',
      activo: true,
    });
    this.cityModalOpen.set(true);
  }

  openEditCityModal(city: City): void {
    this.editingCity.set(city);
    this.cityForm.patchValue({
      nombre: city.nombre,
      departamento: city.departamento,
      activo: city.activo,
    });
    this.cityModalOpen.set(true);
  }

  closeCityModal(): void {
    this.cityModalOpen.set(false);
  }

  saveCity(): void {
    if (this.cityForm.invalid) {
      this.cityForm.markAllAsTouched();
      return;
    }
    const val = this.cityForm.value;
    const editing = this.editingCity();

    if (editing) {
      this.adminApi.updateCity(editing.id, val).subscribe({
        next: () => {
          this.toasts.show(`Ciudad "${val.nombre}" actualizada`, 'info');
          this.closeCityModal();
          this.loadData();
        },
        error: (err) => {
          this.toasts.show('Error al actualizar ciudad: ' + (err.error?.detail || err.message), 'error');
        },
      });
    } else {
      this.adminApi.createCity(val).subscribe({
        next: () => {
          this.toasts.show(`Ciudad "${val.nombre}" creada`, 'info');
          this.closeCityModal();
          this.loadData();
        },
        error: (err) => {
          this.toasts.show('Error al registrar ciudad: ' + (err.error?.detail || err.message), 'error');
        },
      });
    }
  }

  toggleCityStatus(city: City): void {
    this.adminApi.deleteCity(city.id).subscribe({
      next: (res) => {
        this.toasts.show(res.message || 'Estado actualizado', 'info');
        this.loadData();
      },
      error: (err) => {
        this.toasts.show('Error al cambiar estado: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  activeBranchesCount(): number {
    return this.branches().filter((b) => b.activo).length;
  }

  activeCitiesCount(): number {
    return this.cities().filter((c) => c.activo).length;
  }

  getBranchCountByCity(cityId: number): number {
    return this.branches().filter((b) => b.ciudad_id === cityId).length;
  }
}

