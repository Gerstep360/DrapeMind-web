import {
  Component,
  ElementRef,
  ViewChild,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OfflineService, offlineMessage } from '../cu13_catalogo_offline/cu13-offline.service';
import { DownloadedOrdersService } from '../cu24_pedidos/cu24-pedidos-descargados.service';
import { DeferredCheckoutService } from '../cu23_pagos/cu23-deferred-checkout.service';
import { CartService } from '../../core/cart.service';
import { AuthService } from '../../core/auth.service';

type Step = { name: string; state: 'waiting' | 'running' | 'done' | 'failed' };
@Component({
  selector: 'app-store-download',
  imports: [CommonModule, RouterLink],
  templateUrl: './cu12-tienda-descargada.component.html',
  styleUrl: './cu12-tienda-descargada.component.scss',
})
export class StoreDownloadComponent implements OnDestroy {
  readonly offline = inject(OfflineService);
  private orders = inject(DownloadedOrdersService);
  private deferred = inject(DeferredCheckoutService);
  private cart = inject(CartService);
  readonly auth = inject(AuthService);
  @ViewChild('downloadDialog') dialog?: ElementRef<HTMLDialogElement>;
  readonly open = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly complete = signal(false);
  readonly steps = signal<Step[]>([]);
  readonly count = computed(
    () =>
      this.offline.pending() +
      this.deferred.purchases().filter((p) => !this.deferred.isTerminal(p)).length,
  );
  readonly done = computed(() => this.steps().filter((s) => s.state === 'done').length);
  readonly saved = computed(() => this.offline.usable());
  private owner: string | null = null;
  constructor() {
    effect(() => {
      const owner = this.offline.owner();
      if (owner !== this.owner) {
        this.owner = owner;
        untracked(() => {
          this.close();
          this.complete.set(false);
          this.steps.set([]);
          this.error.set('');
        });
      }
    });
  }
  show() {
    const element = this.dialog?.nativeElement;
    if (!element || element.open) return;
    element.showModal();
    this.open.set(true);
  }
  close() {
    this.dialog?.nativeElement.close();
    this.open.set(false);
  }
  backdrop(event: MouseEvent) {
    if (event.target !== this.dialog?.nativeElement) return;
    const r = this.dialog!.nativeElement.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      this.close();
  }
  private step(index: number, state: Step['state']) {
    this.steps.update((rows) => rows.map((s, i) => (i === index ? { ...s, state } : s)));
  }
  async download() {
    if (this.busy()) return;
    if (!navigator.onLine) {
      this.error.set(
        'Conéctate para actualizar la descarga. Tu selección guardada sigue disponible.',
      );
      return;
    }
    const owner = this.offline.owner();
    if (!owner) {
      this.error.set('Inicia sesión en una tienda para descargarla.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.complete.set(false);
    this.steps.set(
      [
        'Colección, tallas y fotografías',
        'Tu carrito',
        this.auth.user()?.rol === 'CLIENTE'
          ? 'Datos para confirmar la compra'
          : 'Reservas y stock de sucursales',
        'Historial de pedidos',
      ].map((name) => ({ name, state: 'waiting' })),
    );
    let current = 0;
    try {
      this.step(0, 'running');
      await this.offline.download();
      if (owner !== this.offline.owner()) return;
      if (!this.offline.usable())
        throw new Error('No se pudo guardar una descarga vigente de esta tienda.');
      this.step(0, 'done');
      this.offline.online.set(true);
      current = 1;
      this.step(1, 'running');
      await this.cart.prepareDownload();
      if (owner !== this.offline.owner()) return;
      this.step(1, 'done');
      current = 2;
      this.step(2, 'running');
      if (this.auth.user()?.rol === 'CLIENTE') await this.deferred.prepareDownload();
      if (owner !== this.offline.owner()) return;
      this.step(2, 'done');
      current = 3;
      this.step(3, 'running');
      await this.orders.prepareDownload();
      if (owner !== this.offline.owner()) return;
      this.step(3, 'done');
      this.complete.set(true);
    } catch (error) {
      if (owner === this.offline.owner()) {
        this.step(current, 'failed');
        this.error.set('No se completó la descarga. ' + offlineMessage(error));
      }
    } finally {
      this.busy.set(false);
    }
  }
  ngOnDestroy() {
    this.close();
  }
}
