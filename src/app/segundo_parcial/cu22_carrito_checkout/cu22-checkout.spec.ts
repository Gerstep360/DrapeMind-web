import {TestBed} from '@angular/core/testing';
import {HttpClient,provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting,HttpTestingController} from '@angular/common/http/testing';
import {confirmCheckout} from './cu22-checkout';
describe('Incremento III checkout recovery',()=>{
 let http:HttpClient,requests:HttpTestingController;
 const payload={tipo_entrega:'RECOJO' as const,sucursal_id:1};
 beforeEach(()=>{localStorage.clear();localStorage.setItem('drapemind_user',JSON.stringify({id:4,tenant_id:1}));TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});http=TestBed.inject(HttpClient);requests=TestBed.inject(HttpTestingController);});
 afterEach(()=>{requests.verify();localStorage.clear();});
 it('recovers the existing order after a lost reply without creating another',async()=>{
  const first=confirmCheckout(http,'/api/v1',payload);
  const post=requests.expectOne('/api/v1/orders/checkout');
  const uuid=post.request.body.operacion_id;
  const rejected=expect(first).rejects.toBeTruthy();post.error(new ProgressEvent('error'));await rejected;
  const recovered=confirmCheckout(http,'/api/v1',payload);
  requests.expectOne(`/api/v1/orders/checkout-operations/${uuid}`).flush({id:27});
  expect((await recovered).id).toBe(27);
  requests.expectNone('/api/v1/orders/checkout');
  expect(localStorage.getItem('drapemind.checkout.pending|/api/v1|1:4')).toBeNull();
 });
 it('keeps the pending UUID when authentication expires',async()=>{
  const work=confirmCheckout(http,'/api/v1',payload);
  const request=requests.expectOne('/api/v1/orders/checkout');
  const rejected=expect(work).rejects.toBeTruthy();request.flush({}, {status:401,statusText:'Unauthorized'});await rejected;
  expect(localStorage.getItem('drapemind.checkout.pending|/api/v1|1:4')).toContain(request.request.body.operacion_id);
 });
});
