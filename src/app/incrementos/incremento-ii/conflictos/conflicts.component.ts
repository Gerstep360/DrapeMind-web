import { Component, ChangeDetectorRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { RuntimeConfigService } from '../../../core/runtime-config.service';
import { SyncedOperation } from '../offline/offline.models';
import { offlineMessage } from '../offline/offline.service';
@Component({
  selector: 'app-sync-conflicts',
  imports: [CommonModule, FormsModule],
  templateUrl: './conflicts.component.html',
  styleUrl: '../feature.scss',
})
export class ConflictsComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private runtime = inject(RuntimeConfigService);
  rows: SyncedOperation[] = [];
  selected: SyncedOperation | null = null;
  audit: any[] = [];
  error = '';
  busy = false;
  note = '';
  acceptPrice = false;
  refunded = false;
  showResolved = false;
  hasMore = false;
  get visible() {
    return this.rows.filter((r) => this.showResolved || r.estado === 'CONFLICT');
  }
  async ngOnInit() {
    await this.load();
  }
  async load(more = false) {
    this.busy = true;
    this.error = '';
    try {
      const rows = await firstValueFrom(
        this.http
          .get<SyncedOperation[]>(`${this.runtime.apiUrl}/retail/conflicts`, {
            params:
              more && this.rows.length ? { before_id: this.rows[this.rows.length - 1].id } : {},
          })
          .pipe(timeout(15000)),
      );
      this.rows = more ? [...this.rows, ...rows] : rows;
      this.hasMore = rows.length === 200;
    } catch (e) {
      this.error = offlineMessage(e);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
  async open(row: SyncedOperation) {
    this.selected = row;
    this.note = '';
    this.acceptPrice = false;
    this.refunded = false;
    this.audit = [];
    try {
      this.audit = await firstValueFrom(
        this.http.get<any[]>(`${this.runtime.apiUrl}/retail/operations/${row.id}/audit`),
      );
    } catch (e) {
      this.error = offlineMessage(e);
    }
    this.cdr.markForCheck();
  }
  async resolve(action: 'RETRY' | 'REJECT') {
    if (!this.selected || this.busy) return;
    if (this.note.trim().length < 5) {
      this.error = 'Escribe el motivo de la resolución.';
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      await firstValueFrom(
        this.http
          .post(`${this.runtime.apiUrl}/retail/operations/${this.selected.id}/resolve`, {
            accion: action,
            motivo: this.note,
            aceptar_precio_guardado: this.acceptPrice,
            efectivo_devuelto: this.refunded,
          })
          .pipe(timeout(25000)),
      );
      this.selected = null;
      await this.load();
    } catch (e) {
      this.error = offlineMessage(e);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
  total(row: SyncedOperation) {
    return (
      row.payload.items.reduce(
        (n, i) => n + Math.round(Number(i.precio_unitario ?? 0) * 100) * i.cantidad,
        0,
      ) / 100
    );
  }
}
