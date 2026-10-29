import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OfflineService, offlineMessage, offlineMediaUrl } from './offline.service';
import { OfflineProduct, QueuedReservation } from './offline.models';
import { RuntimeConfigService } from '../../../core/runtime-config.service';

@Component({
  selector: 'app-offline',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './offline.component.html',
  styleUrl: '../feature.scss',
})
export class OfflineComponent {
  readonly offline = inject(OfflineService);
  private readonly runtime = inject(RuntimeConfigService);
  readonly search = signal('');
  readonly size = signal('');
  readonly color = signal('');
  readonly branch = signal(0);
  readonly draft = signal<OfflineProduct | null>(null);
  readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('reservationDialog');
  readonly saving = signal(false);
  readonly error = signal('');
  variant = 0;
  quantity = 1;
  reserveBranch = 0;
  readonly sizes = computed(() =>
    [...new Set(this.offline.bundle()?.variants.map((v) => v.talla) ?? [])].sort(),
  );
  readonly colors = computed(() =>
    [...new Set(this.offline.bundle()?.variants.map((v) => v.color) ?? [])].sort(),
  );
  readonly products = computed(() => {
    const bundle = this.offline.bundle();
    if (!bundle) return [];
    const q = this.search().trim().toLocaleLowerCase();
    return bundle.products.filter(
      (p) =>
        (!q || `${p.nombre} ${p.descripcion ?? ''}`.toLocaleLowerCase().includes(q)) &&
        bundle.variants.some(
          (v) =>
            v.producto_id === p.id &&
            (!this.size() || v.talla === this.size()) &&
            (!this.color() || v.color === this.color()) &&
            (!this.branch() || this.offline.available(v.id, this.branch()) > 0),
        ),
    );
  });
  variants(product: number) {
    return this.offline.bundle()?.variants.filter((v) => v.producto_id === product) ?? [];
  }
  image(product: OfflineProduct): string {
    return offlineMediaUrl(this.runtime.apiUrl, product.imagenes?.[0] ?? '');
  }
  open(product: OfflineProduct): void {
    this.draft.set(product);
    this.variant = this.variants(product.id)[0]?.id ?? 0;
    this.quantity = 1;
    this.reserveBranch = this.branch() || this.offline.bundle()?.branches[0]?.id || 0;
    this.error.set('');
    this.dialog()?.nativeElement.showModal();
  }
  async reserve(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.offline.reserve(+this.variant, +this.reserveBranch, +this.quantity);
      this.dialog()?.nativeElement.close();
    } catch (e) {
      this.error.set(offlineMessage(e));
    } finally {
      this.saving.set(false);
    }
  }
  state(record: QueuedReservation): string {
    return {
      PENDING: 'Guardada en el dispositivo',
      SENDING: 'Enviando…',
      UNCERTAIN: 'Por comprobar al conectar',
      CONFLICT: 'Necesita tu atención',
      CONFIRMED: 'Recibida por la tienda',
      CANCELLED: 'Cancelada',
      REJECTED: 'Anulada por el encargado',
    }[record.state];
  }
}
