import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
@Component({selector:'app-demand-prediction',imports:[CommonModule],template:`
@if(result();as p){
 @if(p.estado==='DATOS_INSUFICIENTES'){<p role="status">{{p.motivo}}</p><p>Historial disponible: {{p.observaciones}} días y {{p.pedidos_observados}} pedidos pagados.</p>}
 @else{
  <h3>{{p.modelo}}</h3><p>{{p.objetivo}}</p>
  @if(p.entrenamiento){<p class="saved">Modelo guardado · {{p.entrenamiento.fecha|date:'medium'}} · {{p.entrenamiento.reutilizado?'Se reutilizó el entrenamiento vigente':'Entrenamiento actualizado'}}</p>}
  <p>{{p.validacion.tipo}}</p>
  <dl><div><dt>Regresión</dt><dd>{{p.validacion.mae_regresion}} pedidos/día</dd></div><div><dt>Media móvil</dt><dd>{{p.validacion.mae_base}} pedidos/día</dd></div><div><dt>Random Forest</dt><dd>{{p.validacion.mae_random_forest}} pedidos/día</dd></div></dl>
  <div class="table"><table><caption>Próximos siete días</caption><thead><tr><th>Fecha</th><th>Pedidos estimados</th></tr></thead><tbody>@for(row of p.predicciones;track row.fecha){<tr><td>{{row.fecha}}</td><td>{{row.pedidos_estimados|number:'1.0-2'}}</td></tr>}</tbody></table></div>
  <h3>Patrón semanal</h3><ul>@for(row of p.patron_semanal;track row.dia){<li>{{row.dia}}: {{row.pedidos}} pedidos históricos</li>}</ul><p>{{p.alcance}}</p>
 }
}`,styles:[`:host{display:block}dl{display:flex;flex-wrap:wrap;gap:24px;padding:16px 0;border-block:1px solid #d6d2c8}dd{margin:6px 0;font-weight:700}table{width:100%;border-collapse:collapse}th,td{padding:12px;text-align:left;border-bottom:1px solid #d6d2c8}.table{overflow:auto}.saved{background:#e8f3cc;padding:12px}caption{text-align:left;padding:12px 0;font-weight:700}`]})
export class PredictionComponent {readonly result=input<any>(null);}
