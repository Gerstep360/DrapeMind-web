import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { CheckoutRequest, Order } from '../../core/models';

export async function confirmCheckout(http:HttpClient,base:string,payload:CheckoutRequest):Promise<Order>{
  const account=JSON.parse(localStorage.getItem('drapemind_user')??'null');
  if(!account?.id || !account?.tenant_id) throw new Error('Inicia sesión en la tienda antes de confirmar.');
  const owner=`${base}|${account.tenant_id}:${account.id}`;
  const key=`drapemind.checkout.pending|${owner}`;
  const canonical=(value:object)=>JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))));
  const current=canonical(payload);
  let pending=JSON.parse(localStorage.getItem(key)??'null');
  if(pending){
    try{
      const order=await firstValueFrom(http.get<Order>(`${base}/orders/checkout-operations/${pending.operacion_id}`).pipe(timeout(20000)));
      localStorage.removeItem(key);return order;
    }catch(e){if((e as HttpErrorResponse).status!==404)throw e;}
    const {operacion_id,...saved}=pending;
    if(canonical(saved)!==current)throw new Error('Hay una confirmación pendiente. Conserva sus opciones de entrega para comprobarla antes de iniciar otra compra.');
  }else{
    pending={...payload,operacion_id:crypto.randomUUID()};
    localStorage.setItem(key,JSON.stringify(pending));
  }
  const active=JSON.parse(localStorage.getItem('drapemind_user')??'null');
  if(active?.id!==account.id || active?.tenant_id!==account.tenant_id)throw new Error('La sesión cambió; la confirmación sigue guardada en su cuenta.');
  try{
    const order=await firstValueFrom(http.post<Order>(`${base}/orders/checkout`,pending).pipe(timeout(25000)));
    localStorage.removeItem(key);return order;
  }catch(e){
    const status=(e as HttpErrorResponse).status;
    if(status===409 || status===422 || status===404)localStorage.removeItem(key);
    throw e;
  }
}
