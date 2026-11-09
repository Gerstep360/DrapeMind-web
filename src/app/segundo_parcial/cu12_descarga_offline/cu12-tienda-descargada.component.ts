import {DownloadedOrdersService} from '../cu24_pedidos/cu24-pedidos-descargados.service';
import {firstValueFrom} from 'rxjs';
import {Component,inject,signal,computed} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';
import {OfflineService,offlineMessage} from '../cu13_catalogo_offline/cu13-offline.service';
import {DeferredCheckoutService} from '../cu23_pagos/cu23-deferred-checkout.service';
import {CartService} from '../../core/cart.service';
import {AuthService} from '../../core/auth.service';

@Component({selector:'app-store-download',imports:[CommonModule,RouterLink],template:`
<button class="store-download" type="button" (click)="open.set(!open())" aria-label="Datos de esta tienda" [attr.aria-expanded]="open()">
 <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 17a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 17 6a5 5 0 0 1 1 10"/><path d="M12 11v10m-4-4 4 4 4-4"/></svg>
 @if(count()){<span class="count">{{count()}}</span>}
</button>
@if(open()){
 <section class="download-panel" role="dialog" aria-label="Tu tienda sin Internet" (keydown.escape)="open.set(false)">
  <header><h2>Tu tienda, contigo</h2><button type="button" (click)="open.set(false)" aria-label="Cerrar datos de tienda">×</button></header>
  @if(offline.bundle();as saved){<p>{{saved.products.length}} prendas guardadas · {{saved.downloaded_at|date:'d MMM, HH:mm'}}</p>}
  @else{<p>Descarga esta tienda para seguir eligiendo prendas y comprando cuando no tengas Internet.</p>}
  <p class="note">Usarás el mismo catálogo y carrito. Al volver la conexión comprobaremos las existencias y procesaremos el pago.</p>
  @if(busy()){<p role="status">{{offline.phase()||'Guardando los datos de tu tienda…'}}</p>}
  @if(error()){<p role="alert">{{error()}}</p>}
  <button class="primary" type="button" [disabled]="busy()||!connected()" (click)="download()">{{busy()?'Descargando…':offline.bundle()?'Actualizar descarga':'Descargar esta tienda'}}</button>
  @if(!connected()){<p class="note">Estás sin conexión. Puedes usar la última descarga de esta tienda.</p>}
  @if(count()){aquí tienes {{count()}} operaciones por confirmar. <a routerLink="/orders" (click)="open.set(false)">Ver mis pedidos</a>}
 </section>
}`,styles:[`:host{display:inline-flex;position:relative}.store-download{position:relative;display:grid;place-items:center;width:44px;height:44px;border:1px solid #c9c7be;border-radius:50%;color:#151515;background:#f8f7f1;cursor:pointer}.count{position:absolute;right:-2px;top:-3px;font-size:10px;background:#c5ff3d;color:#111;padding:2px 4px}.download-panel{position:fixed;right:20px;top:80px;z-index:1500;width:min(350px,calc(100vw - 32px));padding:20px;background:#fffdf7;border:2px solid #151515;box-shadow:4px 4px #151515;color:#151515;text-align:left;font-size:14px;line-height:1.5}.download-panel header{display:flex;align-items:center;justify-content:space-between;gap:12px}.download-panel h2{font-size:20px;margin:0}.download-panel header button{font-size:22px;border:0;background:transparent;cursor:pointer;min-width:40px;min-height:40px}.note{color:#69675f;font-size:13px}.primary{border:1px solid #151515;background:#c5ff3d;min-height:44px;padding:10px 16px;font:inherit;font-weight:600;cursor:pointer}.primary:disabled{opacity:.5;cursor:wait}button:focus-visible,a:focus-visible{outline:3px solid #839d28;outline-offset:3px}@media(max-width:600px){.download-panel{left:16px;right:16px;top:75px}}`]})
export class StoreDownloadComponent{
 private orders=inject(DownloadedOrdersService);
 readonly offline=inject(OfflineService);private deferred=inject(DeferredCheckoutService);private cart=inject(CartService);private auth=inject(AuthService);
 readonly open=signal(false);readonly busy=signal(false);readonly error=signal('');
 readonly count=computed(()=>this.offline.pending()+this.deferred.purchases().filter(p=>!this.deferred.isTerminal(p)).length);
 connected(){return navigator.onLine;}
 async download(){if(this.busy())return;this.busy.set(true);this.error.set('');
  try{await this.offline.download();if(!this.offline.usable())throw new Error(this.offline.message()||'No pudimos completar la descarga.');
   this.offline.online.set(true);await this.cart.prepareDownload();await firstValueFrom(this.orders.list());if(this.auth.user()?.rol==='CLIENTE'){await this.deferred.refresh();if(!this.deferred.context())throw new Error('El catálogo está guardado. Conecta de nuevo para completar las tarjetas y direcciones de tu compra.');}
  }catch(error){this.error.set(offlineMessage(error));}finally{this.busy.set(false);}}
}
