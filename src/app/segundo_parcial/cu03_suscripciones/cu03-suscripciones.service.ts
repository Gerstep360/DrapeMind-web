import {Injectable,inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {RuntimeConfigService} from '../../core/runtime-config.service';
import type {CompanySubscription} from '../../core/saas.service';
@Injectable({providedIn:'root'})
export class BusinessSubscriptionService {
  private http=inject(HttpClient);private runtime=inject(RuntimeConfigService);
  license(id:number,data:unknown){return this.http.put<CompanySubscription>(`${this.runtime.apiUrl}/saas/tenants/${id}/subscription`,data);}
}
