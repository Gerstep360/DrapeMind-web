import { Component, OnInit, OnDestroy, Input, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, Subscription } from 'rxjs';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { CompanySubscription, saasError } from '../../core/saas.service';

interface PaymentRow {
  id:string; tenant_id:number; company:string; admin:string|null; email:string|null; number:string|null; plan:string|null;
  status:string; currency:string; amount_due:number; amount_paid:number; amount_remaining:number; attempts:number;
  livemode:boolean; issued_at:string; paid_at:string|null; invoice_url:string|null; pdf_url:string|null;
}
interface Summary {currency:string;livemode:boolean;paid_amount_minor:number;pending_amount_minor:number;paid_count:number;pending_count:number;}
interface Month {month:string;currency:string;livemode:boolean;amount_minor:number;}
interface Report {items:PaymentRow[];total:number;summary:Summary[];monthly:Month[];companies:number;last_synced_at:string|null;stripe_configured:boolean;stripe_mode:string;}

@Component({selector:'app-saas-billing',standalone:true,imports:[CommonModule,ReactiveFormsModule],templateUrl:'./cu03-billing-reports.component.html',styleUrl:'./cu03-billing-reports.component.scss'})
export class BillingReportsComponent implements OnInit, OnDestroy {
  @Input() companies: CompanySubscription[]=[];
  private http=inject(HttpClient);private runtime=inject(RuntimeConfigService);private fb=inject(FormBuilder);
  readonly data=signal<Report|null>(null);readonly loading=signal(false);readonly syncing=signal(false);readonly exporting=signal(false);
  readonly error=signal('');readonly notice=signal('');readonly imported=signal(0);readonly offset=signal(0);
  private request?:Subscription;private destroyed=false;
  readonly filters=this.fb.nonNullable.group({tenant_id:'',since:'',until:'',status:'',mode:'all',search:''});
  readonly charts=computed(()=>(this.data()?.summary??[]).map(group=>{
    const all=(this.data()?.monthly??[]).filter(m=>m.currency===group.currency&&m.livemode===group.livemode);
    const months=all.slice(-12);return {...group,months,limited:all.length>12,max:Math.max(1,...months.map(m=>m.amount_minor))};
  }));
  ngOnInit(){this.load();}
  ngOnDestroy(){this.destroyed=true;this.request?.unsubscribe();}
  params(){return new HttpParams({fromObject:Object.fromEntries(Object.entries(this.filters.getRawValue()).filter(([,v])=>v!==''))});}
  load(offset=0){
    this.request?.unsubscribe();this.offset.set(offset);this.loading.set(true);this.error.set('');
    this.request=this.http.get<Report>(this.runtime.apiUrl+'/saas/billing',{params:this.params().set('offset',offset).set('limit',25)}).subscribe({
      next:result=>{this.data.set(result);this.loading.set(false);},error:e=>{this.error.set(saasError(e));this.loading.set(false);}
    });
  }
  async synchronize(){
    if(this.syncing())return;this.syncing.set(true);this.imported.set(0);this.error.set('');this.notice.set('');
    let cursor:string|null=null;
    try{
      do {
        if(this.destroyed)return;
        const page:{imported:number;next_cursor:string|null}=await firstValueFrom(this.http.post<{imported:number;next_cursor:string|null}>(this.runtime.apiUrl+'/saas/billing/sync',{cursor}));
        this.imported.update(n=>n+page.imported);cursor=page.next_cursor;
      }while(cursor);
      if(!this.destroyed){this.notice.set('Historial actualizado desde Stripe. No se realizó ningún cobro.');this.load();}
    }catch(e){if(!this.destroyed){this.error.set(saasError(e));if(this.imported()>0)this.notice.set(`${this.imported()} facturas guardadas. Vuelve a actualizar para completar el historial.`);}}
    finally{this.syncing.set(false);}
  }
  money(amount:number,currency:string){return new Intl.NumberFormat('es-BO',{style:'currency',currency}).format(Number(amount));}
  label(status:string){return ({paid:'Pagada',open:'Pendiente',draft:'Borrador',void:'Anulada',uncollectible:'Incobrable'} as Record<string,string>)[status]??status;}
  monthLabel(value:string){const [y,m]=value.split('-').map(Number);return new Intl.DateTimeFormat('es',{month:'short',year:'numeric'}).format(new Date(y,m-1,1));}
  async export(format:'pdf'|'xlsx'){
    if(this.exporting())return;this.exporting.set(true);this.error.set('');
    try{
      const blob=await firstValueFrom(this.http.get(this.runtime.apiUrl+'/saas/billing/export',{params:this.params().set('format',format),responseType:'blob'}));
      if(this.destroyed)return;
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`pagos-saas.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){this.error.set(saasError(e));}finally{this.exporting.set(false);}
  }
}
