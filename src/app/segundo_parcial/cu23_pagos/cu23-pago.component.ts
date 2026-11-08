import {AfterViewInit,Component,ElementRef,OnDestroy,ViewChild,inject,input,output,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {firstValueFrom,timeout} from 'rxjs';
import {loadStripe} from '@stripe/stripe-js/pure';
import type {Stripe,StripeElements,StripePaymentElement} from '@stripe/stripe-js';
import {CommerceApiService} from '../../core/api/commerce-api.service';
import {Payment} from '../../core/models';

@Component({selector:'app-stripe-payment',imports:[CommonModule],template:`
<section class="payment" aria-label="Pago seguro con Stripe">
  <header><strong>Tu pago, con Stripe</strong><p>Introduce tu tarjeta y autoriza el importe del pedido.</p></header>
  @if(busy()){<p role="status">{{status()}}</p>}
  @if(error()){<p class="error" role="alert">{{error()}}</p>}
  @if(approved()){<p class="confirmed" role="status">Stripe confirmó tu pago. El pedido ya está registrado.</p>}
  <div #host [hidden]="approved()"></div>
  @if(!approved()){
    <button class="primary" type="button" [disabled]="!ready()||busy()" (click)="pay()">Autorizar pago de Bs {{amount()|number:'1.2-2'}}</button>
    <button type="button" [disabled]="busy()" (click)="ready()?verify():prepare()">{{ready()?'Consultar estado':'Reintentar conexión'}}</button>
    <p class="note">Si se interrumpe la conexión, consulta este mismo pedido. La confirmación depende del servidor y de Stripe.</p>
  }
</section>`,styles:[`:host{display:block}.payment{border-top:2px solid #161616;padding:24px 0;margin:16px 0}.payment header{margin-bottom:18px}.payment p{line-height:1.6}.payment button{padding:13px 18px;min-height:46px;margin:16px 10px 0 0;border:1px solid #171717;background:white;font:inherit;cursor:pointer}.payment button.primary{background:#161616;color:white}.payment button:disabled{opacity:.5;cursor:wait}.error{color:#a01f26;background:#fff0ed;padding:12px}.confirmed{background:#e4f4bc;padding:16px}.note{font-size:.85rem;color:#5c5b56}button:focus-visible{outline:3px solid #8caa32;outline-offset:3px}`]})
export class StripePaymentComponent implements AfterViewInit,OnDestroy {
  readonly orderId=input.required<number>();readonly paid=output<Payment>();
  readonly busy=signal(false);readonly ready=signal(false);readonly approved=signal(false);readonly status=signal('');readonly error=signal('');readonly amount=signal(0);
  @ViewChild('host')host!:ElementRef<HTMLDivElement>;
  private api=inject(CommerceApiService);private stripe:Stripe|null=null;private elements?:StripeElements;private element?:StripePaymentElement;
  paymentId?:number;private destroyed=false;private timer?:ReturnType<typeof setTimeout>;
  ngAfterViewInit(){void this.prepare();}
  async prepare(){
    if(this.busy()||this.destroyed)return;this.busy.set(true);this.status.set('Preparando el pago seguro…');this.error.set('');
    try{
      const config=await firstValueFrom(this.api.paymentConfiguration().pipe(timeout(15000)));
      if(config.provider!=='stripe')throw new Error('Stripe no está disponible en esta tienda. Tu pedido conserva su estado.');
      const intent=await firstValueFrom(this.api.stripeIntent(this.orderId()).pipe(timeout(25000)));
      this.paymentId=intent.payment_id;this.amount.set(intent.amount/100);
      if(intent.status==='APROBADO'){await this.verify();return;}
      if(intent.sandbox||!intent.publishable_key?.startsWith('pk_'))throw new Error('La tienda debe configurar Stripe para recibir pagos.');
      this.stripe=await loadStripe(intent.publishable_key);if(this.destroyed)return;
      if(!this.stripe)throw new Error('No se pudo cargar Stripe. Revisa la conexión y vuelve a intentarlo.');
      this.element?.destroy();this.elements=this.stripe.elements({clientSecret:intent.client_secret,appearance:{theme:'stripe',variables:{colorPrimary:'#171717',borderRadius:'3px'}}});
      this.element=this.elements.create('payment');this.element.mount(this.host.nativeElement);this.ready.set(true);
    }catch(e:any){if(!this.destroyed)this.error.set(this.message(e));}
    finally{if(!this.destroyed)this.busy.set(false);}
  }
  async pay(){
    if(!this.stripe||!this.elements||this.busy())return;this.busy.set(true);this.error.set('');this.status.set('Esperando la autorización de Stripe…');
    try{
      const result=await this.stripe.confirmPayment({elements:this.elements,confirmParams:{return_url:new URL('orders',document.baseURI).href},redirect:'if_required'});
      if(result.error)this.error.set(result.error.message||'Revisa los datos de la tarjeta.');
      await this.verify();
      if(!this.approved()&&!result.error)this.poll(0);
    }catch(e:any){if(!this.destroyed)this.error.set(this.message(e));}
    finally{if(!this.destroyed)this.busy.set(false);}
  }
  async verify(){
    if(!this.paymentId||this.destroyed)return;
    try{const payment=await firstValueFrom(this.api.payment(this.paymentId).pipe(timeout(15000)));if(this.destroyed)return;
      if(payment.estado==='APROBADO'){if(!this.approved()){this.approved.set(true);this.paid.emit(payment);}if(this.timer)clearTimeout(this.timer);}
      else this.status.set('El servidor todavía está verificando el pago. Puedes consultar este mismo pedido.');
    }catch(e:any){if(!this.destroyed)this.error.set(this.message(e));}
  }
  private poll(attempt:number){if(this.destroyed||this.approved()||attempt>=15)return;this.timer=setTimeout(()=>{void this.verify().then(()=>this.poll(attempt+1));},2000);}
  private message(e:any){const detail=e?.error?.detail;return typeof detail==='string'?detail:e instanceof Error?e.message:'No se pudo consultar Stripe. Tu pedido sigue disponible.';}
  ngOnDestroy(){this.destroyed=true;this.element?.destroy();if(this.timer)clearTimeout(this.timer);}
}
