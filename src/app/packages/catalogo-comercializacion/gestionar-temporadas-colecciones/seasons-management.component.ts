import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApiService } from '@core/api/admin-api.service';
import { Season, SeasonInput } from '@core/models';
import { ToastService } from '@core/toast.service';

@Component({
  selector: 'app-seasons-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './seasons-management.component.html',
  styleUrl: './seasons-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeasonsManagementComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);

  readonly seasons = signal<Season[]>([]);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly searchQuery = signal('');
  readonly filterActive = signal<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  readonly modalOpen = signal(false);
  readonly editingSeason = signal<Season | null>(null);

  seasonForm!: FormGroup;

  readonly filteredSeasons = computed(() => {
    let list = this.seasons();
    const q = this.searchQuery().trim().toLowerCase();
    const active = this.filterActive();

    if (q) {
      list = list.filter(
        (s) =>
          s.nombre.toLowerCase().includes(q) ||
          s.codigo.toLowerCase().includes(q) ||
          (s.descripcion && s.descripcion.toLowerCase().includes(q)),
      );
    }

    if (active === 'ACTIVE') {
      list = list.filter((s) => s.activo);
    } else if (active === 'INACTIVE') {
      list = list.filter((s) => !s.activo);
    }

    return list;
  });

  readonly stats = computed(() => {
    const list = this.seasons();
    const total = list.length;
    const vigentes = list.filter((s) => s.activo).length;
    const now = new Date().getTime();
    const proximas = list.filter(
      (s) => s.fecha_inicio && new Date(s.fecha_inicio).getTime() > now,
    ).length;
    return { total, vigentes, proximas };
  });

  ngOnInit(): void {
    this.initForm();
    this.loadSeasons();
  }

  private initForm(): void {
    this.seasonForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      codigo: ['', [Validators.required, Validators.pattern(/^[A-Z0-9_-]{3,50}$/)]],
      descripcion: [''],
      fecha_inicio: [null],
      fecha_fin: [null],
      activo: [true],
    });
  }

  loadSeasons(): void {
    this.loading.set(true);
    this.adminApi.listSeasons().subscribe({
      next: (data) => {
        this.seasons.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.toasts.show('Error al cargar temporadas: ' + (err.error?.detail || err.message), 'error');
        this.loading.set(false);
      },
    });
  }

  openCreateModal(): void {
    this.editingSeason.set(null);
    this.seasonForm.reset({
      nombre: '',
      codigo: '',
      descripcion: '',
      fecha_inicio: null,
      fecha_fin: null,
      activo: true,
    });
    this.modalOpen.set(true);
  }

  openEditModal(season: Season): void {
    this.editingSeason.set(season);
    this.seasonForm.patchValue({
      nombre: season.nombre,
      codigo: season.codigo,
      descripcion: season.descripcion || '',
      fecha_inicio: season.fecha_inicio ? season.fecha_inicio.substring(0, 10) : null,
      fecha_fin: season.fecha_fin ? season.fecha_fin.substring(0, 10) : null,
      activo: season.activo,
    });
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editingSeason.set(null);
  }

  saveSeason(): void {
    if (this.seasonForm.invalid) {
      this.seasonForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const formVal = this.seasonForm.value;
    const payload: SeasonInput = {
      nombre: formVal.nombre.trim(),
      codigo: formVal.codigo.trim().toUpperCase(),
      descripcion: formVal.descripcion ? formVal.descripcion.trim() : null,
      fecha_inicio: formVal.fecha_inicio ? new Date(formVal.fecha_inicio).toISOString() : null,
      fecha_fin: formVal.fecha_fin ? new Date(formVal.fecha_fin).toISOString() : null,
      activo: formVal.activo,
    };

    const current = this.editingSeason();
    if (current) {
      this.adminApi.updateSeason(current.id, payload).subscribe({
        next: (updated) => {
          this.seasons.update((list) =>
            list.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.toasts.show(`Colección "${updated.nombre}" actualizada.`, 'success');
          this.submitting.set(false);
          this.closeModal();
        },
        error: (err) => {
          this.toasts.show('Error al actualizar colección: ' + (err.error?.detail || err.message), 'error');
          this.submitting.set(false);
        },
      });
    } else {
      this.adminApi.createSeason(payload).subscribe({
        next: (created) => {
          this.seasons.update((list) => [created, ...list]);
          this.toasts.show(`Colección "${created.nombre}" lanzada con éxito.`, 'success');
          this.submitting.set(false);
          this.closeModal();
        },
        error: (err) => {
          this.toasts.show('Error al crear colección: ' + (err.error?.detail || err.message), 'error');
          this.submitting.set(false);
        },
      });
    }
  }

  toggleSeasonStatus(season: Season): void {
    const payload: SeasonInput = {
      nombre: season.nombre,
      codigo: season.codigo,
      descripcion: season.descripcion,
      fecha_inicio: season.fecha_inicio,
      fecha_fin: season.fecha_fin,
      activo: !season.activo,
    };

    this.adminApi.updateSeason(season.id, payload).subscribe({
      next: (updated) => {
        this.seasons.update((list) =>
          list.map((s) => (s.id === updated.id ? updated : s)),
        );
        const st = updated.activo ? 'activada' : 'desactivada';
        this.toasts.show(`Colección "${updated.nombre}" ${st}.`, 'success');
      },
      error: (err) => {
        this.toasts.show('Error al cambiar estado: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  deleteSeason(season: Season): void {
    const confirmed = window.confirm(
      `¿Desea eliminar la temporada / colección "${season.nombre}"?`,
    );
    if (!confirmed) return;

    this.adminApi.deleteSeason(season.id).subscribe({
      next: () => {
        this.seasons.update((list) => list.filter((s) => s.id !== season.id));
        this.toasts.show(`Colección "${season.nombre}" eliminada.`, 'success');
      },
      error: (err) => {
        this.toasts.show('Error al eliminar colección: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  getCampaignStage(season: Season): { label: string; class: string } {
    if (!season.activo) {
      return { label: 'Inactiva', class: 'stage-inactive' };
    }
    const now = new Date().getTime();
    if (season.fecha_inicio && new Date(season.fecha_inicio).getTime() > now) {
      return { label: 'Próximamente', class: 'stage-upcoming' };
    }
    if (season.fecha_fin && new Date(season.fecha_fin).getTime() < now) {
      return { label: 'Finalizada', class: 'stage-ended' };
    }
    return { label: 'En Campaña', class: 'stage-current' };
  }
}
