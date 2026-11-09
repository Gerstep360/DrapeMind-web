import {Injectable,inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {defer,from,catchError,tap,throwError,Observable} from 'rxjs';
import {AuthService} from '../../core/auth.service';
import {RuntimeConfigService} from '../../core/runtime-config.service';
import {Order} from '../../core/models';
import {OfflineService} from '../cu13_catalogo_offline/cu13-offline.service';
import {DeferredStore} from '../cu23_pagos/cu23-deferred-store';

@Injectable({providedIn:'root'})
export class DownloadedOrdersService{
 private auth=inject(AuthService);private runtime=inject(RuntimeConfigService);private offline=inject(OfflineService);private http=inject(HttpClient);private store=new DeferredStore();
 private scope(){const u=this.auth.user();return u?.tenant_id&&this.auth.isAuthenticated()?`${this.runtime.apiUrl}|${u.tenant_id}:${u.id}|orders:${u.rol}`:'';}
 list():Observable<Order[]>{return defer(()=>{
   const owner=this.scope();
   const cached=async()=>{await this.offline.snapshot();const saved=await this.store.read<{rows:Order[];savedAt:string}>('context',owner);return owner===this.scope()&&saved&&Date.parse(saved.savedAt)+7*86400000>Date.now()?saved.rows:[];};
   if(!navigator.onLine||!this.offline.online())return from(cached());
   return this.http.get<Order[]>(this.runtime.apiUrl+'/orders').pipe(tap(rows=>{if(owner&&owner===this.scope())void this.store.write('context',{key:owner,rows,savedAt:new Date().toISOString()}).catch(()=>{});}),
     catchError(error=>[0,502,503,504].includes(error.status)?from(cached()):throwError(()=>error)));
 });}
}
