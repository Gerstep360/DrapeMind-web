import {Component,OnDestroy,OnInit,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom,timeout} from 'rxjs';
import {RuntimeConfigService} from '../../core/runtime-config.service';
import {offlineMessage} from '../incremento-ii/offline/offline.service';

type Report={id:number;consulta:string;titulo:string;analisis:string;recomendaciones:string[];datos:{empresa:string;desde:string;hasta:string;sucursal:string;pedidos_pagados:number;ingreso_neto_cobrado:string;inventario_actual:{unidades_disponibles:number;variantes_con_stock_bajo:number};prendas_vendidas:{nombre:string;cantidad:number}[];alcance:string}};
type Recognition={lang:string;interimResults:boolean;onresult:((e:{results:{transcript:string}[][]})=>void)|null;onerror:(()=>void)|null;onend:(()=>void)|null;start():void;stop():void;abort():void};
@Component({selector:'app-business-reports',imports:[CommonModule,FormsModule],templateUrl:'./reports.component.html',styleUrls:['../incremento-ii/feature.scss','./reports.component.scss']})
export class BusinessReportsComponent implements OnInit,OnDestroy{
 private http=inject(HttpClient);private runtime=inject(RuntimeConfigService);
 readonly report=signal<Report|null>(null);readonly history=signal<Report[]>([]);readonly branches=signal<{id:number;nombre:string}[]>([]);
 readonly busy=signal(false);readonly listening=signal(false);readonly error=signal('');
 query='';from='';to='';branch='';entry:'TEXTO'|'VOZ'='TEXTO';private recognition?:Recognition;
 readonly voiceSupported=!!((window as any).SpeechRecognition||(window as any).webkitSpeechRecognition);
 get base(){return this.runtime.apiUrl;}
 async ngOnInit(){
  const result=await Promise.allSettled([firstValueFrom(this.http.get<Report[]>(`${this.base}/business-reports`)),firstValueFrom(this.http.get<{id:number;nombre:string}[]>(`${this.base}/branches`))]);
  if(result[0].status==='fulfilled')this.history.set(result[0].value);else this.error.set(offlineMessage(result[0].reason));
  if(result[1].status==='fulfilled')this.branches.set(result[1].value);
 }
 selectExample(q:string){this.query=q;this.entry='TEXTO';}
 async generate(){
  if(this.busy()||this.query.trim().length<5)return;
  this.recognition?.stop();this.busy.set(true);this.error.set('');
  try{
   const result=await firstValueFrom(this.http.post<Report>(`${this.base}/business-reports`,{consulta:this.query.trim(),entrada:this.entry,...(this.from?{desde:this.from}:{}),...(this.to?{hasta:this.to}:{}),...(this.branch?{sucursal_id:+this.branch}:{})}).pipe(timeout(90000)));
   this.report.set(result);this.history.update(rows=>[result,...rows].slice(0,30));
  }catch(e){this.error.set(offlineMessage(e));}finally{this.busy.set(false);}
 }
 dictate(){
  if(this.listening()){this.recognition?.stop();return;}
  const Constructor=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
  if(!Constructor){this.error.set('Este navegador no admite dictado. Puedes escribir la consulta.');return;}
  const r:Recognition=new Constructor();r.lang='es-BO';r.interimResults=false;
  r.onresult=e=>{this.query=Array.from(e.results).map(row=>row[0].transcript).join(' ');this.entry='VOZ';};
  r.onerror=()=>{this.error.set('No se pudo completar el dictado. Revisa el permiso del micrófono o escribe tu consulta.');this.listening.set(false);};
  r.onend=()=>this.listening.set(false);this.recognition=r;
  try{this.listening.set(true);r.start();}catch{this.error.set('No se pudo iniciar el micrófono.');}
 }
 async download(format:'pdf'|'xlsx'='pdf'){
  const row=this.report();if(!row)return;this.error.set('');
  try{const blob=await firstValueFrom(this.http.get(`${this.base}/business-reports/${row.id}/${format}`,{responseType:'blob'}));const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`reporte-${row.id}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){this.error.set(offlineMessage(e));}
 }
 ngOnDestroy(){this.recognition?.abort();}
}
