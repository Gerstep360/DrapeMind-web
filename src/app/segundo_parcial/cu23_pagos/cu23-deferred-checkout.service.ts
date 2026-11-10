import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { Cart } from '../../core/models';
import { CartService } from '../../core/cart.service';
import { DeferredStore, PendingPurchase, PurchaseResult } from './cu23-deferred-store';

export interface SavedCard {id:number;marca:string;ultimos_cuatro:string;mes_vencimiento:number;anio_vencimiento:number}
export interface PurchaseContext {owner:string;downloaded_at:string;valid_until:string;cart:Cart;cards:SavedCard[];delivery_fee:string;branches:{id:number;nombre:string;direccion:string}[];addresses:{id:number;alias:string;ciudad:string}[]}
const terminal=new Set(['PAGADA','CANCELADA','RECHAZADA','VENCIDA']);
export const purchaseLabel=(state:string)=>({ESPERANDO_CONEXION:'En espera de conexión',PENDIENTE_SINCRONIZACION:'Pendiente de sincronizar',PROCESANDO_PAGO:'En proceso de pago',PENDIENTE_RESULTADO:'Verificando con Stripe',REQUIERE_METODO:'Falta elegir tarjeta',REQUIERE_AUTENTICACION:'Tu banco pide verificación',PAGADA:'Compra pagada',RECHAZADA:'Compra anulada',CANCELADA:'Compra cancelada',VENCIDA:'Solicitud vencida',CANCELACION_PENDIENTE:'Cancelación pendiente'}[state]||state);

@Injectable({providedIn:'root'})
export class DeferredCheckoutService {
  private readonly http=inject(HttpClient);private readonly auth=inject(AuthService);private readonly runtime=inject(RuntimeConfigService);
  private readonly store=new DeferredStore();private owner='';private syncing=false;private restoring:Promise<void>=Promise.resolve();
  get ready(){return this.restoring;}
  async useCart(cart:Cart){await this.ready;const value=this.context(),owner=this.owner;if(!owner||!value)throw new Error('Descarga los datos de compra de esta tienda con conexión.');const next={...value,cart};await this.store.write('context',{key:owner,value:next});if(owner===this.owner)this.context.set(next);}
  private readonly cart=inject(CartService);
  readonly context=signal<PurchaseContext|null>(null);readonly purchases=signal<PendingPurchase[]>([]);
  readonly online=signal(typeof navigator==='undefined'||navigator.onLine);readonly busy=signal(false);readonly error=signal('');
  constructor(){
    effect(()=>{const cart=this.cart.cart();untracked(()=>{const value=this.context(),owner=this.owner;if(cart&&value&&owner){const next={...value,cart};this.context.set(next);void this.store.write('context',{key:owner,value:next}).catch(()=>this.error.set('No se pudo actualizar la copia local del carrito.'));}});});
    effect(()=>{const u=this.auth.user();const token=this.auth.token();untracked(()=>{const next=token&&u?.rol==='CLIENTE'?`${this.runtime.apiUrl}|${u.tenant_id}:${u.id}`:'';if(next===this.owner)return;this.owner=next;this.context.set(null);this.purchases.set([]);if(next)this.restoring=this.restore(next);});});
    window.addEventListener('online',()=>{this.online.set(true);void this.refresh();});window.addEventListener('offline',()=>this.online.set(false));
    window.addEventListener('focus',()=>{if(navigator.onLine)void this.refresh();});
    setInterval(()=>{if(this.owner&&navigator.onLine&&this.purchases().some(r=>!this.isTerminal(r)))void this.synchronize();},30000);
  }
  private async restore(owner:string):Promise<void>{try{const cached=await this.store.read<{key:string;value:PurchaseContext}>('context',owner);if(owner!==this.owner)return;this.context.set(cached?.value||null);await this.reloadLocal(owner);void this.refresh();}catch{this.error.set('No pudimos abrir el almacenamiento local. No se guardó ninguna compra nueva.');}}
  private async reloadLocal(owner=this.owner){const rows=await this.store.list(owner);if(owner===this.owner)this.purchases.set(rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));}
  async prepareDownload():Promise<void>{
    await this.ready;const owner=this.owner;if(!owner)throw new Error('Inicia sesión en esta tienda antes de preparar tu compra.');
    const value=await firstValueFrom(this.http.get<PurchaseContext>(this.runtime.apiUrl+'/payments/deferred/context').pipe(timeout(15000)));
    if(owner!==this.owner||value.owner!==owner.split('|').at(-1))throw new Error('La tienda cambió. Abre de nuevo la descarga.');
    const snapshot=this.cart.cart()?{...value,cart:this.cart.cart()!}:value;
    await this.store.write('context',{key:owner,value:snapshot});if(owner===this.owner)this.context.set(snapshot);
  }
  async refresh():Promise<void>{
    const owner=this.owner;if(!owner||!navigator.onLine)return;
    try{await this.cart.local.synchronize();const value=await firstValueFrom(this.http.get<PurchaseContext>(this.runtime.apiUrl+'/payments/deferred/context').pipe(timeout(15000)));if(owner!==this.owner||value.owner!==owner.split('|').at(-1))return;await this.store.write('context',{key:owner,value});this.context.set(this.cart.cart()?{...value,cart:this.cart.cart()!}:value);
      const server=await firstValueFrom(this.http.get<PurchaseResult[]>(this.runtime.apiUrl+'/payments/deferred').pipe(timeout(15000)));if(owner!==this.owner)return;
      for(const row of server){const key=`${owner}|${row.operacion_id}`;const current=await this.store.read<PendingPurchase>('purchases',key);await this.store.write('purchases',{...current,key,owner,operation:row.operacion_id,createdAt:current?.createdAt||new Date().toISOString(),label:current?.label||'Compra de esta tienda',remote:row});}
      await this.reloadLocal(owner);await this.synchronize();
    }catch{if(owner===this.owner)this.error.set('Estás usando la copia local. Las compras siguen guardadas hasta recuperar conexión.');}
  }
  async enqueue(options:{tipo_entrega:string;sucursal_id:number|null;direccion_id:number|null;tarjeta_id:number|null;total_autorizado:string;autorizar_cobro_automatico:boolean;codigo_promocion?:string|null}):Promise<string>{
    const owner=this.owner,context=this.context();if(!owner||!context||!context.cart.items.length)throw new Error('Descarga tu carrito con conexión antes de guardar una compra.');
    if(new Date(context.valid_until).getTime()<Date.now())throw new Error('Actualiza la copia de tu tienda con conexión antes de guardar otra compra.');
    const items=context.cart.items.map(i=>({variante_id:i.variante_id,cantidad:i.cantidad})).sort((a,b)=>a.variante_id-b.variante_id);
    if(this.purchases().some(r=>!this.isTerminal(r)&&JSON.stringify(r.body?.['items'])===JSON.stringify(items)))throw new Error('Estas prendas ya tienen una compra pendiente. Revísala antes de crear otra.');
    const operation=crypto.randomUUID();const createdAt=new Date().toISOString();
    const body={...options,items,operacion_id:operation,creado_en_dispositivo:createdAt};
    await this.store.write('purchases',{key:`${owner}|${operation}`,owner,operation,body,createdAt,label:context.cart.items.map(i=>`${i.cantidad} × ${i.nombre}`).join(', '),localState:'ESPERANDO_CONEXION'});
    await this.reloadLocal(owner);if(navigator.onLine)void this.synchronize();return operation;
  }
  isTerminal(row:PendingPurchase):boolean{return terminal.has(row.remote?.estado||row.localState||'');}
  state(row:PendingPurchase):string{return row.cancelRequested&&!this.isTerminal(row)?'CANCELACION_PENDIENTE':row.remote?.estado||row.localState||'ESPERANDO_CONEXION';}
  label= purchaseLabel;
  private async saveRemote(row:PendingPurchase,result:PurchaseResult){const current=await this.store.read<PendingPurchase>('purchases',row.key);await this.store.write('purchases',{...row,...current,remote:result});
    const value=this.context();if(result.estado==='PAGADA'&&value&&this.owner===row.owner){const basket=value.cart.items.map(i=>({variante_id:i.variante_id,cantidad:i.cantidad})).sort((a,b)=>a.variante_id-b.variante_id);if(JSON.stringify(basket)===JSON.stringify(row.body?.['items'])){const next={...value,cart:{...value.cart,items:[],subtotal:0,total_items:0}};this.context.set(next);await this.store.write('context',{key:row.owner,value:next});this.cart.loadCart();}}
  }
  async synchronize():Promise<void>{
    const owner=this.owner;if(!owner||this.syncing||!navigator.onLine)return;this.syncing=true;this.busy.set(true);
    try{for(const row of await this.store.list(owner)){
      if(owner!==this.owner)return;if(this.isTerminal(row))continue;
      const base=this.runtime.apiUrl+'/payments/deferred';let url:string;let body:any={};
      if(row.cancelRequested&&row.body){url=base+'/cancel-pending';body=row.body;}
      else if(row.cancelRequested)url=base+'/'+row.operation+'/cancel';
      else if(row.body&&!row.remote){url=base;body=row.body;}
      else url=base+'/'+row.operation+'/sync';
      try{const remote=await firstValueFrom(this.http.post<PurchaseResult>(url,body).pipe(timeout(60000)));await this.saveRemote(row,remote);}
      catch(e:any){if(owner!==this.owner)return;if(e?.status===401||e?.status===402||e?.status===403)throw e;this.error.set('Hay una operación pendiente de comprobar. Se conservará su identificador para evitar cobros duplicados.');}
    }}catch{this.error.set('La sincronización necesita una sesión y un plan activos en esta tienda. Tus compras siguen guardadas.');}finally{this.syncing=false;this.busy.set(false);await this.reloadLocal(owner);}
  }
  async cancel(row:PendingPurchase):Promise<void>{await this.store.write('purchases',{...row,cancelRequested:true});await this.reloadLocal();await this.synchronize();}
  async chooseCard(row:PendingPurchase,card:number){const remote=await firstValueFrom(this.http.post<PurchaseResult>(this.runtime.apiUrl+'/payments/deferred/'+row.operation+'/method',{tarjeta_id:card,autorizar_cobro_automatico:true}).pipe(timeout(60000)));await this.saveRemote(row,remote);await this.reloadLocal();}
  async authenticate(row:PendingPurchase){return firstValueFrom(this.http.post<{client_secret?:string;publishable_key?:string}>(this.runtime.apiUrl+'/payments/deferred/'+row.operation+'/authenticate',{}).pipe(timeout(45000)));}
  async verify(row:PendingPurchase){const result=await firstValueFrom(this.http.get<PurchaseResult>(this.runtime.apiUrl+'/payments/deferred/'+row.operation).pipe(timeout(45000)));await this.saveRemote(row,result);await this.reloadLocal();}
}
