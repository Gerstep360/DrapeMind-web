import { Component, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthService } from '../../../core/auth.service';
import { RuntimeConfigService } from '../../../core/runtime-config.service';
import { offlineMessage } from '../offline/offline.service';

interface Supplier {
  id: number;
  nombre_empresa: string;
  nit?: string;
  contacto_nombre?: string;
  telefono?: string;
  email?: string;
  ciudad: string;
  direccion?: string;
  categoria_suministro?: string;
  activo: boolean;
  usuario_id?: number;
  usuario_email?: string;
}
interface Offer {
  id: number;
  nombre_suministro: string;
  sku_proveedor?: string;
  categoria: string;
  unidad_medida: string;
  costo_unitario: number;
  cantidad_disponible: number;
  tiempo_entrega_dias: number;
  estado: string;
  activo: boolean;
}
interface SupplyOrder {
  id: number;
  proveedor_id: number;
  proveedor: string;
  sucursal: string;
  estado: string;
  total: string;
  created_at: string;
  items: { nombre: string; cantidad: number }[];
}

@Component({
  selector: 'app-supply',
  imports: [CommonModule, FormsModule],
  templateUrl: './supply.component.html',
  styleUrl: '../feature.scss',
})
export class SupplyComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);
  readonly suppliers = signal<Supplier[]>([]);
  readonly offers = signal<Offer[]>([]);
  readonly orders = signal<SupplyOrder[]>([]);
  readonly selected = signal<Supplier | null>(null);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly editor = viewChild<ElementRef<HTMLDialogElement>>('editor');
  readonly offerEditor = viewChild<ElementRef<HTMLDialogElement>>('offerEditor');
  readonly accountEditor = viewChild<ElementRef<HTMLDialogElement>>('accountEditor');
  branches: { id: number; nombre: string }[] = [];
  variants: { id: number; nombre: string }[] = [];
  supplierDraft: any = {};
  offerDraft: any = {};
  accountDraft = { nombre: '', email: '', password: '' };
  editingOffer = 0;
  orderBranch = 0;
  orderNote = '';
  lines: { suministro_id: number; variante_id: number | null; cantidad: number }[] = [];
  requestId = crypto.randomUUID();
  get admin() {
    return this.auth.user()?.rol === 'ADMIN';
  }
  private get base() {
    return `${this.runtime.apiUrl}/supply`;
  }
  private request<T>(path: string, body?: unknown, method = 'GET'): Promise<T> {
    return firstValueFrom(
      this.http
        .request<T>(method, `${this.base}${path}`, body === undefined ? {} : { body })
        .pipe(timeout(25000)),
    );
  }
  async ngOnInit() {
    await this.load();
  }
  async load() {
    this.busy.set(true);
    this.error.set('');
    try {
      const [suppliers, orders] = await Promise.all([
        this.request<Supplier[]>('/suppliers'),
        this.request<SupplyOrder[]>('/orders'),
      ]);
      this.suppliers.set(suppliers);
      this.orders.set(orders);
      if (this.admin) {
        const d = await this.request<{
          branches: { id: number; nombre: string }[];
          variants: { id: number; nombre: string }[];
        }>('/destinations');
        this.branches = d.branches;
        this.variants = d.variants;
        this.orderBranch ||= d.branches[0]?.id ?? 0;
      }
      const current = suppliers.find((s) => s.id === this.selected()?.id) ?? suppliers[0];
      if (current) await this.select(current);
      else {
        this.selected.set(null);
        this.offers.set([]);
      }
    } catch (e) {
      this.error.set(offlineMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async select(supplier: Supplier) {
    this.selected.set(supplier);
    this.offers.set([]);
    this.lines = [];
    this.requestId = crypto.randomUUID();
    try {
      const offers = await this.request<Offer[]>(`/suppliers/${supplier.id}/offers`);
      if (this.selected()?.id === supplier.id) this.offers.set(offers);
    } catch (e) {
      this.error.set(offlineMessage(e));
    }
  }
  editSupplier(supplier?: Supplier) {
    this.supplierDraft = supplier
      ? { ...supplier }
      : { nombre_empresa: '', ciudad: 'La Paz', categoria_suministro: 'Prendas', activo: true };
    this.editor()?.nativeElement.showModal();
  }
  editOffer(offer?: Offer) {
    this.editingOffer = offer?.id ?? 0;
    this.offerDraft = offer
      ? { ...offer }
      : {
          nombre_suministro: '',
          sku_proveedor: '',
          categoria: 'Prendas',
          unidad_medida: 'Unidades',
          costo_unitario: 1,
          cantidad_disponible: 0,
          tiempo_entrega_dias: 5,
          estado: 'DISPONIBLE',
          activo: true,
        };
    this.offerEditor()?.nativeElement.showModal();
  }
  openAccount() {
    this.accountDraft = {
      nombre: this.selected()?.contacto_nombre ?? '',
      email: this.selected()?.email ?? '',
      password: '',
    };
    this.accountEditor()?.nativeElement.showModal();
  }
  async saveSupplier() {
    await this.mutate(async () => {
      const {
        nombre_empresa,
        nit,
        contacto_nombre,
        telefono,
        email,
        ciudad,
        direccion,
        categoria_suministro,
        activo,
      } = this.supplierDraft;
      const value = await this.request<Supplier>(
        this.supplierDraft.id ? `/suppliers/${this.supplierDraft.id}` : '/suppliers',
        {
          nombre_empresa,
          nit: nit || null,
          contacto_nombre: contacto_nombre || null,
          telefono: telefono || null,
          email: email || null,
          ciudad,
          direccion: direccion || null,
          categoria_suministro,
          activo,
        },
        this.supplierDraft.id ? 'PUT' : 'POST',
      );
      this.selected.set(value);
      this.editor()?.nativeElement.close();
      this.message.set('Proveedor guardado.');
    });
  }
  async saveOffer() {
    await this.mutate(async () => {
      const {
        nombre_suministro,
        sku_proveedor,
        categoria,
        unidad_medida,
        costo_unitario,
        cantidad_disponible,
        tiempo_entrega_dias,
        estado,
        activo,
      } = this.offerDraft;
      await this.request(
        `/suppliers/${this.selected()!.id}/offers${this.editingOffer ? '/' + this.editingOffer : ''}`,
        {
          nombre_suministro,
          sku_proveedor: sku_proveedor || null,
          categoria,
          unidad_medida,
          costo_unitario,
          cantidad_disponible,
          tiempo_entrega_dias,
          estado,
          activo,
        },
        this.editingOffer ? 'PUT' : 'POST',
      );
      this.offerEditor()?.nativeElement.close();
      this.message.set('Oferta actualizada.');
    });
  }
  async saveAccount() {
    await this.mutate(async () => {
      await this.request(`/suppliers/${this.selected()!.id}/account`, this.accountDraft, 'POST');
      this.accountDraft.password = '';
      this.accountEditor()?.nativeElement.close();
      this.message.set('Cuenta de proveedor creada. Comparte su acceso de forma privada.');
    });
  }
  addLine() {
    const offer = this.offers().find(
      (o) =>
        o.activo && o.cantidad_disponible > 0 && !this.lines.some((l) => l.suministro_id === o.id),
    );
    if (offer) this.lines.push({ suministro_id: offer.id, variante_id: null, cantidad: 1 });
  }
  total() {
    return this.lines.reduce(
      (sum, line) =>
        sum +
        Number(this.offers().find((o) => o.id === +line.suministro_id)?.costo_unitario ?? 0) *
          line.cantidad,
      0,
    );
  }
  async createOrder() {
    await this.mutate(async () => {
      await this.request(
        '/orders',
        {
          request_id: this.requestId,
          proveedor_id: this.selected()!.id,
          sucursal_id: +this.orderBranch,
          observacion: this.orderNote || null,
          items: this.lines.map((l) => ({
            ...l,
            suministro_id: +l.suministro_id,
            variante_id: l.variante_id ? +l.variante_id : null,
            cantidad: +l.cantidad,
          })),
        },
        'POST',
      );
      this.requestId = crypto.randomUUID();
      this.lines = [];
      this.orderNote = '';
      this.message.set('Pedido solicitado. El proveedor puede confirmar las unidades.');
    });
  }
  async act(order: SupplyOrder, action: string) {
    await this.mutate(async () => {
      await this.request(`/orders/${order.id}/${action}`, {}, 'POST');
      this.message.set(
        action === 'receive'
          ? 'Recepción registrada y existencias actualizadas.'
          : 'Estado del pedido actualizado.',
      );
    });
  }
  private async mutate(operation: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await operation();
      await this.load();
    } catch (e) {
      this.error.set(offlineMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
