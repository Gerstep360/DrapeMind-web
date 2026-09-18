import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '@core/api/admin-api.service';
import { ExecutiveReportRequest, ExecutiveReportResponse } from '@core/models';
import { ToastService } from '@core/toast.service';

@Component({
  selector: 'app-business-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './business-reports.component.html',
  styleUrl: './business-reports.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessReportsComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly toasts = inject(ToastService);

  readonly generating = signal(false);
  readonly report = signal<ExecutiveReportResponse | null>(null);

  selectedType: ExecutiveReportRequest['tipo_reporte'] = 'VENTAS_Y_TENDENCIAS';
  selectedPeriod: ExecutiveReportRequest['periodo'] = 'MES_ACTUAL';
  customFocus = '';

  readonly reportTypes = [
    {
      id: 'VENTAS_Y_TENDENCIAS',
      title: 'Ventas y Tendencias Comerciales',
      desc: 'Facturación, ticket promedio, cumplimiento de entregas y prendas de mayor demanda.',
    },
    {
      id: 'INVENTARIO_Y_STOCK',
      title: 'Salud de Inventario y Rotación',
      desc: 'Existencias en taller, variantes bajo umbral crítico y sincronización de compras.',
    },
    {
      id: 'ASISTENCIA_IA_Y_CLIENTES',
      title: 'Eficacia de Asistencia IA y Clientes',
      desc: 'Volumen de consultas a Altair, latencia de respuesta y conversión a carrito.',
    },
    {
      id: 'ESTRATEGICO_GLOBAL',
      title: 'Diagnóstico Estratégico Integral',
      desc: 'Visión directiva de 360 grados con recomendaciones corporativas de alto impacto.',
    },
  ];

  ngOnInit(): void {
    // Generar automáticamente el primer reporte ejecutivo al ingresar
    this.generateReport();
  }

  generateReport(): void {
    this.generating.set(true);

    const req: ExecutiveReportRequest = {
      tipo_reporte: this.selectedType,
      periodo: this.selectedPeriod,
      enfoque_especifico: this.customFocus.trim() || null,
    };

    this.adminApi.generateExecutiveReport(req).subscribe({
      next: (data) => {
        this.report.set(data);
        this.generating.set(false);
        this.toasts.show('Informe gerencial elaborado con éxito por Altair AI.', 'success');
      },
      error: (err) => {
        this.generating.set(false);
        this.toasts.show('Error al generar informe: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  copySummary(): void {
    const rep = this.report();
    if (!rep) return;

    const summaryText = `INFORME EJECUTIVO DRAPEMIND - ${rep.tipo_reporte} (${rep.fecha_generacion})
Periodo: ${rep.periodo}

RESUMEN EJECUTIVO:
${rep.resumen_ejecutivo}

DIAGNÓSTICO DE RENDIMIENTO:
${rep.diagnostico_rendimiento}

CUELLOS DE BOTELLA:
${rep.cuellos_de_botella.map((b, i) => `${i + 1}. ${b}`).join('\n')}

PLAN DE ACCIÓN ESTRATÉGICO:
${rep.recomendaciones_estrategicas.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;

    navigator.clipboard.writeText(summaryText).then(() => {
      this.toasts.show('Síntesis del informe copiada al portapapeles.', 'success');
    });
  }

  printReport(): void {
    window.print();
  }
}
