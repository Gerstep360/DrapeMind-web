import {Injectable,inject,signal,effect} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom,timeout} from 'rxjs';
import {AuthService} from '../../core/auth.service';
import {RuntimeConfigService} from '../../core/runtime-config.service';
import {Cart,CartItem} from '../../core/models';
import {OfflineService} from '../cu13_catalogo_offline/cu13-offline.service';
import {downloadedProducts} from '../cu13_catalogo_offline/cu13-catalogo-descargado';
import {DeferredStore} from '../cu23_pagos/cu23-deferred-store';

type Line={variante_id:number;cantidad:number};
type Draft={key:string;cart:Cart;base:Line[];dirty:boolean};
const lines=(cart:Cart|null):Line[]=>(cart?.items||[]).map(i=>({variante_id:i.variante_id,cantidad:i.cantidad}));

@Injectable({providedIn:'root'})
export class LocalCartService {
  private auth=inject(AuthService);private runtime=inject(RuntimeConfigService);private http=inject(HttpClient);
  private offline=inject(OfflineService);private store=new DeferredStore();
  readonly current=signal<Cart|null>(null);readonly dirty=signal(false);readonly issue=signal('');
  private owner='';private base:Line[]=[];private restoring:Promise<void>=Promise.resolve();private sync?:Promise<Cart|null>;private editing?:Promise<Cart>;
  constructor(){effect(()=>this.bind());window.addEventListener('online',()=>{void this.synchronize();});}
  private scope(){const u=this.auth.user();return this.auth.isAuthenticated()&&u?.tenant_id&&!u.is_platform_admin?`${this.runtime.apiUrl}|${u.tenant_id}:${u.id}`:'';}
  scopeKey(){return this.scope();}
  private bind(){const owner=this.scope();if(owner===this.owner)return;this.owner=owner;this.current.set(null);this.dirty.set(false);this.issue.set('');this.base=[];
    this.restoring=owner?this.restore(owner):Promise.resolve();}
  get ready(){this.bind();return this.restoring;}
  private async restore(owner:string){try{const saved=await this.store.read<Draft>('context',owner+'|cart-draft');
    const cached=saved?null:await this.store.read<{value:{cart:Cart}}>('context',owner);
    if(owner!==this.owner)return;if(saved){this.base=saved.base;this.dirty.set(saved.dirty);this.current.set(saved.cart);}else if(cached?.value?.cart){this.base=lines(cached.value.cart);this.current.set(cached.value.cart);}
  }catch{/* Online shopping remains available when local storage cannot open. */}}
  async acceptServer(cart:Cart,expectedOwner=this.scope(),waitForEdits=true){const pending=this.editing;if(waitForEdits&&pending)await pending.catch(()=>{});await this.ready;const owner=this.owner;if(!owner||owner!==expectedOwner||this.dirty())return;
    this.base=lines(cart);this.current.set(cart);this.issue.set('');
    try{await this.store.write('context',{key:owner+'|cart-draft',cart,base:this.base,dirty:false});}catch{if(owner===this.owner)this.issue.set('No se pudo guardar este carrito para usarlo sin conexión.');}
  }
  active(){return !navigator.onLine||!this.offline.online()||this.dirty();}
  async keepSelection(){
    await this.sync;await this.editing;await this.ready;
    const owner=this.owner,remote=await firstValueFrom(this.http.get<Cart>(this.runtime.apiUrl+'/cart').pipe(timeout(15000)));
    if(owner!==this.owner||!this.current())return;
    this.base=lines(remote);await this.store.write('context',{key:owner+'|cart-draft',base:this.base,cart:this.current(),dirty:true});
    this.dirty.set(true);await this.synchronize();
  }
  edit(action:'add'|'replace'|'quantity'|'remove',selection:Line[]=[],id?:number,quantity?:number):Promise<Cart>{
    const expected=this.scope(),priorEdit=this.editing,priorSync=this.sync;
    const targetVariant=this.current()?.items.find(i=>i.id===id)?.variante_id;
    const work=(async()=>{if(priorEdit)await priorEdit.catch(()=>{});if(priorSync)await priorSync;if(expected!==this.scope())throw new Error('La tienda cambió. Vuelve a abrir tu carrito.');const resolvedId=targetVariant?this.current()?.items.find(i=>i.variante_id===targetVariant)?.id:id;return this.editNow(action,selection,resolvedId,quantity);})();
    this.editing=work;
    return work.finally(()=>{if(this.editing===work)this.editing=undefined;}).then(cart=>{if(navigator.onLine&&this.offline.online())void this.synchronize();return cart;});
  }
  private async editNow(action:'add'|'replace'|'quantity'|'remove',selection:Line[]=[],id?:number,quantity?:number):Promise<Cart>{
    await this.ready;const owner=this.owner;if(!owner)throw new Error('Inicia sesión para usar el carrito.');
    const bundle=await this.offline.snapshot();const products=downloadedProducts(bundle);
    const prior=this.current()??{id:0,estado:'ACTIVO',items:[],subtotal:0,total_items:0};
    let items=action==='replace'?[]:prior.items.map(i=>({...i}));
    if(action==='remove')items=items.filter(i=>i.id!==id);
    if(action==='quantity'){const item=items.find(i=>i.id===id);if(item)item.cantidad=quantity!;}
    for(const line of selection){
      const existing=items.find(i=>i.variante_id===line.variante_id);
      if(existing){existing.cantidad+=line.cantidad;continue;}
      const product=products.find(p=>p.variantes?.some(v=>v.id===line.variante_id));
      const variant=product?.variantes?.find(v=>v.id===line.variante_id);
      if(!product||!variant)throw new Error('Esta variante no forma parte de la tienda descargada.');
      items.push({id:-variant.id,variante_id:variant.id,producto_id:product.id,nombre:product.nombre,sku:variant.sku,color:variant.color,talla:variant.talla,cantidad:line.cantidad,precio_unitario:product.precio,subtotal:0,stock_disponible:variant.stock_disponible,imagen:typeof product.imagenes[0]==='string'?product.imagenes[0]:null});
    }
    if(items.length>50)throw new Error('Puedes llevar hasta 50 variantes en una compra.');
    for(const item of items){if(item.cantidad<1||item.cantidad>20)throw new Error('Elige entre 1 y 20 unidades de cada variante.');
      if(item.cantidad>item.stock_disponible)throw new Error('La cantidad supera la disponibilidad de la descarga.');
      item.subtotal=+(item.precio_unitario*item.cantidad).toFixed(2);}
    const cart:Cart={...prior,items,total_items:items.reduce((n,i)=>n+i.cantidad,0),subtotal:+items.reduce((n,i)=>n+i.subtotal,0).toFixed(2)};
    await this.store.write('context',{key:owner+'|cart-draft',base:this.base,cart,dirty:true});
    if(owner!==this.owner)throw new Error('La tienda cambió. Vuelve a abrir tu carrito.');
    this.current.set(cart);this.dirty.set(true);this.issue.set('');
    return cart;
  }
  synchronize():Promise<Cart|null>{const priorEdit=this.editing;return this.sync??=(async()=>{
    if(priorEdit)await priorEdit.catch(()=>{});
    await this.ready;const owner=this.owner,cart=this.current();if(!owner||!cart||!this.dirty()||!navigator.onLine)return cart;
    try{const result=await firstValueFrom(this.http.put<Cart>(this.runtime.apiUrl+'/cart/draft',{base_items:this.base,items:lines(cart)}).pipe(timeout(15000)));
      if(owner!==this.owner)return null;this.dirty.set(false);await this.acceptServer(result,owner,false);return result;
    }catch(e:any){if(owner===this.owner){if(e.status===409)this.issue.set(e.error?.detail?.message||'Tu carrito cambió. Revisa la selección antes de pagar.');else if(![0,502,503,504].includes(e.status))this.issue.set(typeof e.error?.detail==='string'?e.error.detail:'Revisa tu sesión antes de continuar con el carrito.');}return cart;}
  })().finally(()=>{this.sync=undefined;});}
}
