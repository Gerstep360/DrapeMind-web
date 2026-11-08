import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { loadStripe } from '@stripe/stripe-js/pure';
import type { Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js';
import { RuntimeConfigService } from '@core/runtime-config.service';
import { AuthService } from '@core/auth.service';
import { saasError } from '@core/saas.service';
import { DeferredCheckoutService } from './deferred-checkout.service';
import { PendingPurchase } from './deferred-store';

@Component({selector:'app-deferred-checkout',standalone:true,imports:[CommonModule,FormsModule,RouterLink],
  templateUrl:'./deferred-checkout.component.html',styleUrl:'./deferred-checkout.component.scss'})
export class DeferredCheckoutComponent implements OnDestroy {
  readonly queue=inject(DeferredCheckoutService);readonly auth=inject(AuthService);
  private readonly http=inject(HttpClient);private readonly runtime=inject(RuntimeConfigService);
  @ViewChild('cardDialog') dialog!:ElementRef<HTMLDialogElement>;
  @ViewChild('cardHost') host!:ElementRef<HTMLDivElement>;
  delivery='RECOJO';branch:number|null=null;address:number|null=null;card:number|null=null;
  consent=false;saveConsent=false;readonly saving=signal(false);readonly error=signal('');readonly feedback=signal('');readonly setupReady=signal(false);
  consentTotal='';
  setConsent(checked:boolean){this.consent=checked;this.consentTotal=checked?this.total().toFixed(2):'';}
  private stripe:Stripe|null=null;private elements?:StripeElements;private paymentElement?:StripePaymentElement;private setupId='';private destroyed=false;
  constructor(){void this.queue.refresh();}
  total():number{return Number(this.queue.context()?.cart.subtotal||0)+(this.delivery==='DELIVERY'?Number(this.queue.context()?.delivery_fee||0):0);}
  async save(){this.error.set('');this.saving.set(true);try{
    if(this.delivery==='RECOJO'&&!this.branch)throw new Error('Elige una sucursal para recoger tus prendas.');
    if(this.delivery==='DELIVERY'&&!this.address)throw new Error('Elige una dirección guardada de esta tienda.');
    if(this.card&&(!this.consent||this.consentTotal!==this.total().toFixed(2)))throw new Error('Revisa y autoriza el importe actual antes de guardar la compra.');
    await this.queue.enqueue({tipo_entrega:this.delivery,sucursal_id:this.delivery==='RECOJO'?this.branch:null,direccion_id:this.delivery==='DELIVERY'?this.address:null,
      tarjeta_id:this.card,total_autorizado:this.total().toFixed(2),autorizar_cobro_automatico:!!this.card&&this.consent});
    this.feedback.set('Compra guardada en este dispositivo. Puedes seguir su estado aquí.');
  }catch(e){this.error.set(e instanceof Error?e.message:saasError(e));}finally{this.saving.set(false);}}
  async openCard(){
    this.error.set('');if(!this.queue.online())return;this.saveConsent=false;this.setupReady.set(false);this.dialog.nativeElement.showModal();
  }
  async prepareCard(){
    if(!this.saveConsent||this.saving())return;this.saving.set(true);this.error.set('');
    try{const setup=await firstValueFrom(this.http.post<{setup_intent_id:string;client_secret:string;publishable_key:string}>(this.runtime.apiUrl+'/payments/cards/setup',{operacion_id:crypto.randomUUID(),aceptar_guardado_y_cobros_diferidos:true}));
      this.stripe=await loadStripe(setup.publishable_key);if(this.destroyed||!this.dialog.nativeElement.open)return;
      if(!this.stripe)throw new Error('No pudimos cargar Stripe. Revisa tu conexión.');this.setupId=setup.setup_intent_id;
      this.paymentElement?.destroy();this.elements=this.stripe.elements({clientSecret:setup.client_secret,appearance:{theme:'stripe',variables:{colorPrimary:'#181818',borderRadius:'2px'}}});
      this.paymentElement=this.elements.create('payment');this.paymentElement.mount(this.host.nativeElement);this.setupReady.set(true);
    }catch(e){this.error.set(e instanceof Error?e.message:saasError(e));}finally{this.saving.set(false);}
  }
  async saveCard(){
    if(!this.stripe||!this.elements||!this.saveConsent)return;this.saving.set(true);this.error.set('');
    try{const result=await this.stripe.confirmSetup({elements:this.elements,confirmParams:{return_url:new URL('pending-purchases',document.baseURI).href},redirect:'if_required'});
      if(result.error)throw new Error(result.error.message||'Stripe no pudo guardar la tarjeta.');
      await firstValueFrom(this.http.post(this.runtime.apiUrl+'/payments/cards/confirm',{setup_intent_id:this.setupId,aceptar_guardado_y_cobros_diferidos:true}));
      this.dialog.nativeElement.close();await this.queue.refresh();this.feedback.set('Tarjeta guardada en Stripe. Solo se conserva su marca y terminación en este dispositivo.');
    }catch(e){this.error.set(e instanceof Error?e.message:saasError(e));}finally{this.saving.set(false);}
  }
  async action(row:PendingPurchase,action:'cancel'|'verify'|'card'|'authenticate'){
    this.saving.set(true);this.error.set('');
    try{if(action==='cancel')await this.queue.cancel(row);
      else if(action==='verify')await this.queue.verify(row);
      else if(action==='card'){if(!this.card)throw new Error('Selecciona la tarjeta que usarás para esta compra.');if(!window.confirm(`¿Autorizas un único cobro de Bs ${row.remote?.total_autorizado} con la tarjeta seleccionada para esta compra pendiente?`))return;await this.queue.chooseCard(row,this.card);}
      else {const result=await this.queue.authenticate(row);if(result.client_secret&&result.publishable_key){const stripe=await loadStripe(result.publishable_key);if(!stripe)throw new Error('No pudimos abrir la verificación de Stripe.');const verified=await stripe.handleNextAction({clientSecret:result.client_secret});if(verified.error)throw new Error(verified.error.message||'Verificación pendiente.');}await this.queue.verify(row);}
    }catch(e){this.error.set(e instanceof Error?e.message:saasError(e));}finally{this.saving.set(false);}
  }
  ngOnDestroy(){this.destroyed=true;this.paymentElement?.destroy();}
}
