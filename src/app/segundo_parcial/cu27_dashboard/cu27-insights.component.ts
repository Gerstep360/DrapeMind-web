import {PredictionComponent} from '../cu28_machine_learning/cu28-prediction.component';
import {Component,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {RuntimeConfigService} from '../../core/runtime-config.service';
import {offlineMessage} from '../cu13_catalogo_offline/cu13-offline.service';

@Component({selector:'app-commercial-insights',imports:[CommonModule,FormsModule,RouterLink,PredictionComponent],templateUrl:'./cu27-insights.component.html',styleUrls:['../compartido/feature.scss','../cu25_reportes_voz/cu25-reports.component.scss']})
export class InsightsComponent {
 private http=inject(HttpClient);private runtime=inject(RuntimeConfigService);
 readonly busy=signal(false);readonly error=signal('');readonly data=signal<any>(null);readonly prediction=signal<any>(null);readonly branches=signal<{id:number;nombre:string}[]>([]);
 days=30;branch='';
 constructor(){void this.load();void firstValueFrom(this.http.get<{id:number;nombre:string}[]>(`${this.runtime.apiUrl}/branches`)).then(rows=>this.branches.set(rows)).catch(()=>{});}
 async load(){
  if(this.busy())return;this.busy.set(true);this.error.set('');this.prediction.set(null);
  try{this.data.set(await firstValueFrom(this.http.get(`${this.runtime.apiUrl}/business-dashboard`,{params:{days:this.days,...(this.branch?{sucursal_id:this.branch}:{})}})));}catch(e){this.data.set(null);this.error.set(offlineMessage(e));}finally{this.busy.set(false);}
 }
 async predict(force=false){
  if(this.busy())return;this.busy.set(true);this.error.set('');this.prediction.set(null);
  try{this.prediction.set(await firstValueFrom((force?this.http.post(`${this.runtime.apiUrl}/business-predictions/train`,{}, {params:this.branch?{sucursal_id:this.branch}:{}}):this.http.get(`${this.runtime.apiUrl}/business-predictions`,{params:this.branch?{sucursal_id:this.branch}:{}}))));}catch(e){this.error.set(offlineMessage(e));}finally{this.busy.set(false);}
 }
}
