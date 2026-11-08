import {Injectable,inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {RuntimeConfigService} from '../../core/runtime-config.service';
import type {SaaSPlan} from '../../core/saas.service';
@Injectable({providedIn:'root'})
export class PlanService {
  private http=inject(HttpClient);private runtime=inject(RuntimeConfigService);
  private get url(){return this.runtime.apiUrl+'/saas/plans';}
  plans(){return this.http.get<SaaSPlan[]>(this.url);}
  price(id:number,interval:'month'|'year'='month'){return this.http.get<{amount_minor:number;currency:string;interval:string}>(`${this.url}/${id}/price`,{params:{interval}});}
  savePlan(id:number,data:unknown){return this.http.put<SaaSPlan>(`${this.url}/${id}`,data);}
  configurePrice(id:number,data:unknown){return this.http.post<SaaSPlan>(`${this.url}/${id}/stripe-price`,data);}
}
