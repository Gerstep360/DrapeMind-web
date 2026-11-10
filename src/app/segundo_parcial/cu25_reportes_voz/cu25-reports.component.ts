import { marked } from 'marked';
import { VoiceInputService } from '../compartido/voice-input.service';
import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { offlineMessage } from '../cu13_catalogo_offline/cu13-offline.service';

export type Report = {
  id: number;
  consulta: string;
  titulo: string;
  analisis: string;
  recomendaciones: string[];
  datos: {
    empresa: string;
    desde: string;
    hasta: string;
    sucursal: string;
    pedidos_pagados: number;
    ingreso_neto_cobrado: string;
    inventario_actual: { unidades_disponibles: number; variantes_con_stock_bajo: number };
    prendas_vendidas: { nombre: string; cantidad: number }[];
    alcance: string;
  };
};
@Component({
  providers: [VoiceInputService],
  selector: 'app-business-reports',
  imports: [CommonModule, FormsModule],
  templateUrl: './cu25-reports.component.html',
  styleUrl: './cu25-reports.component.scss',
})
export class BusinessReportsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private runtime = inject(RuntimeConfigService);
  readonly report = signal<Report | null>(null);
  readonly history = signal<Report[]>([]);
  readonly branches = signal<{ id: number; nombre: string }[]>([]);
  readonly exporting = signal<'pdf' | 'xlsx' | null>(null);
  readonly busy = signal(false);
  readonly voice = inject(VoiceInputService);
  readonly listening = this.voice.listening;
  readonly error = signal('');
  query = '';
  from = '';
  to = '';
  branch = '';
  entry: 'TEXTO' | 'VOZ' = 'TEXTO';

  readonly analysisHtml = computed(
    () => marked.parse(this.report()?.analisis || '', { async: false, breaks: true }) as string,
  );
  readonly maxUnits = computed(() =>
    Math.max(1, ...(this.report()?.datos.prendas_vendidas || []).map((p) => p.cantidad)),
  );
  readonly soldUnits = computed(() =>
    (this.report()?.datos.prendas_vendidas || []).reduce((sum, p) => sum + p.cantidad, 0),
  );
  selectReport(row: Report) {
    this.report.set(row);
    this.error.set('');
  }
  get base() {
    return this.runtime.apiUrl;
  }
  async ngOnInit() {
    const result = await Promise.allSettled([
      firstValueFrom(this.http.get<Report[]>(`${this.base}/business-reports`)),
      firstValueFrom(this.http.get<{ id: number; nombre: string }[]>(`${this.base}/branches`)),
    ]);
    if (result[0].status === 'fulfilled') this.history.set(result[0].value);
    else this.error.set(offlineMessage(result[0].reason));
    if (result[1].status === 'fulfilled') this.branches.set(result[1].value);
  }
  selectExample(q: string) {
    this.query = q;
    this.entry = 'TEXTO';
  }
  async generate() {
    if (
      this.busy() ||
      this.voice.processing() ||
      this.voice.listening() ||
      this.query.trim().length < 5
    )
      return;
    if (!!this.from !== !!this.to || this.from > this.to) {
      this.error.set('Elige ambas fechas y un periodo válido.');
      return;
    }
    this.voice.cancel();
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(
        this.http
          .post<Report>(`${this.base}/business-reports`, {
            consulta: this.query.trim(),
            entrada: this.entry,
            ...(this.from ? { desde: this.from } : {}),
            ...(this.to ? { hasta: this.to } : {}),
            ...(this.branch ? { sucursal_id: +this.branch } : {}),
          })
          .pipe(timeout(90000)),
      );
      this.report.set(result);
      this.history.update((rows) => [result, ...rows].slice(0, 30));
    } catch (e) {
      this.error.set(offlineMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  dictate() {
    if (this.voice.listening()) {
      void this.voice.stop();
      return;
    }
    if (this.busy() || this.voice.processing()) return;
    this.error.set('');
    void this.voice.start(
      'REPORTE',
      (text) => {
        this.query = [this.query.trim(), text].filter(Boolean).join(' ').slice(0, 1000);
        this.entry = 'VOZ';
      },
      (e) => this.error.set(e.message),
    );
  }

  async download(format: 'pdf' | 'xlsx' = 'pdf') {
    const row = this.report();
    if (!row || this.exporting()) return;
    this.error.set('');
    this.exporting.set(format);
    try {
      const blob = await firstValueFrom(
        this.http.get(`${this.base}/business-reports/${row.id}/${format}`, {
          responseType: 'blob',
        }),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-${row.id}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      this.error.set(offlineMessage(e));
    } finally {
      this.exporting.set(null);
    }
  }
  ngOnDestroy() {
    this.voice.cancel();
  }
}
