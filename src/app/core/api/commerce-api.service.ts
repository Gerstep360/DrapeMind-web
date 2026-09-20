import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Cart, CheckoutRequest, Order, Payment, PaymentCreate, ReceiptData, User } from '@core/models';
import { RuntimeConfigService } from '@core/runtime-config.service';

export interface PosSalePayload {
  sucursal_id: number;
  cliente_id?: number | null;
  items: Array<{ variante_id: number; cantidad: number; precio_unitario: number }>;
  metodo_pago: string;
  numero_factura?: string | null;
}
export interface PosSaleResult { pedido_id: number; total: number; estado: string; pago_estado: string; mensaje: string; }

@Injectable({ providedIn: 'root' })
export class CommerceApiService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  paymentConfiguration(): Observable<{ provider: string }> { return this.http.get<{ provider: string }>(`${this.runtime.apiUrl}/payments/config`); }
  stripeIntent(orderId: number): Observable<{ payment_id: number; client_secret: string; publishable_key: string; amount: number; currency: string; status: string; sandbox?: boolean }> {
    return this.http.post<any>(`${this.runtime.apiUrl}/payments/stripe-intent`, { order_id: orderId });
  }
  confirmStripeSandbox(paymentId: number): Observable<Payment> { return this.http.post<Payment>(`${this.runtime.apiUrl}/payments/stripe-sandbox-confirm`, { payment_id: paymentId }); }
  applyAiSelection(items: Array<{ variante_id: number; cantidad: number }>): Observable<Cart> { return this.http.post<Cart>(`${this.runtime.apiUrl}/ai/recommendations/apply`, { items, replace_cart: true }); }
  searchCustomers(query: string): Observable<User[]> { return this.http.get<User[]>(`${this.runtime.apiUrl}/admin/customers/search`, { params: { q: query } }); }
  createPosSale(payload: PosSalePayload): Observable<PosSaleResult> { return this.http.post<PosSaleResult>(`${this.runtime.apiUrl}/admin/sales/pos`, payload); }
  payment(id: number): Observable<Payment> { return this.http.get<Payment>(`${this.runtime.apiUrl}/payments/${id}`); }
  receipt(orderId: number): Observable<Blob> { return this.http.get(`${this.runtime.apiUrl}/orders/${orderId}/receipt?format=text`, { responseType: 'blob' }); }
  receiptData(orderId: number): Observable<ReceiptData> { return this.http.get<ReceiptData>(`${this.runtime.apiUrl}/orders/${orderId}/receipt?format=json`); }
  publicReceiptData(orderId: number): Observable<ReceiptData> { return this.http.get<ReceiptData>(`${this.runtime.apiUrl}/orders/${orderId}/public-receipt`); }
  orders(state?: string): Observable<Order[]> { const params = state ? new HttpParams().set('state', state) : undefined; return this.http.get<Order[]>(`${this.runtime.apiUrl}/admin/orders`, { params }); }
  myOrders(): Observable<Order[]> { return this.http.get<Order[]>(`${this.runtime.apiUrl}/orders`); }
  updateOrderStatus(id: number, estado: string): Observable<Order> { return this.http.patch<Order>(`${this.runtime.apiUrl}/orders/${id}/status`, { estado }); }
  confirmCashPayment(id: number): Observable<Order> { return this.http.post<Order>(`${this.runtime.apiUrl}/orders/${id}/cash-confirm`, {}); }
  getCart(): Observable<Cart> { return this.http.get<Cart>(`${this.runtime.apiUrl}/cart`); }
  addCartItem(variante_id: number, cantidad = 1): Observable<Cart> { return this.http.post<Cart>(`${this.runtime.apiUrl}/cart/items`, { variante_id, cantidad }); }
  addCartItemsBatch(items: Array<{ variante_id: number; cantidad: number }>): Observable<Cart> { return this.http.post<Cart>(`${this.runtime.apiUrl}/cart/items/batch`, { items }); }
  replaceCartItemsBatch(items: Array<{ variante_id: number; cantidad: number }>): Observable<Cart> { return this.http.put<Cart>(`${this.runtime.apiUrl}/cart/items/batch`, { items }); }
  updateCartItem(item_id: number, cantidad: number): Observable<Cart> { return this.http.patch<Cart>(`${this.runtime.apiUrl}/cart/items/${item_id}`, { cantidad }); }
  deleteCartItem(item_id: number): Observable<Cart> { return this.http.delete<Cart>(`${this.runtime.apiUrl}/cart/items/${item_id}`); }
  checkout(payload: CheckoutRequest): Observable<Order> { return this.http.post<Order>(`${this.runtime.apiUrl}/orders/checkout`, payload); }
  initiatePayment(payload: PaymentCreate, idempotencyKey?: string): Observable<Payment> { return this.http.post<Payment>(`${this.runtime.apiUrl}/payments`, payload, { headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {} }); }
  mockConfirmPayment(payment_id: number): Observable<Payment> { return this.http.post<Payment>(`${this.runtime.apiUrl}/payments/${payment_id}/mock-confirm`, {}); }
  generateOutfit(payload: { ocasion?: string; presupuesto_max?: number; sesion_id?: string }): Observable<any> {
    return this.http.post<any>(`${this.runtime.apiUrl}/ai/outfits/generate`, payload);
  }
  completeOutfit(payload: { producto_base_id?: number; ocasion?: string; presupuesto_max?: number; sesion_id?: string }): Observable<any> {
    return this.http.post<any>(`${this.runtime.apiUrl}/ai/outfits/complete`, payload);
  }

  // CU-22: Analizar estilo del carrito
  analyzeCartStyle(payload: { objetivo?: string; sesion_id?: number; modelo_ia?: string } = {}): Observable<{
    respuesta: string;
    productos: any[];
    sesion_id?: number;
    skills_ejecutadas?: string[];
  }> {
    const body = { modelo_ia: 'ALTAIR_MINI', ...payload };
    return this.http.post<any>(`${this.runtime.apiUrl}/ai/cart/style-check`, body);
  }

  // CU-23: Optimizar outfit por calidad, precio y ahorro
  optimizeCartValue(payload: { objetivo?: string; sesion_id?: number; modelo_ia?: string } = {}): Observable<{
    respuesta: string;
    productos: any[];
    recomendaciones?: any[];
    sesion_id?: number;
    skills_ejecutadas?: string[];
  }> {
    const body = { modelo_ia: 'ALTAIR_MINI', ...payload };
    return this.http.post<any>(`${this.runtime.apiUrl}/ai/cart/value-check`, body);
  }

  // CU-24: Aplicar recomendación de IA al carrito (reemplazo inteligente)
  applyRecommendation(recomendacionId: number): Observable<Cart> {
    return this.http.post<Cart>(`${this.runtime.apiUrl}/ai/recommendations/apply`, {
      recomendacion_id: recomendacionId,
    });
  }

  // CU-36: Validar código promocional u oferta
  validatePromotion(payload: {
    codigo: string;
    monto_subtotal: number;
    item_producto_ids?: number[];
  }): Observable<{
    valido: boolean;
    codigo: string;
    mensaje: string;
    tipo_descuento?: string;
    valor_descuento?: number;
    descuento_calculado?: number;
    producto_id?: number;
    producto_nombre?: string;
  }> {
    return this.http.post<any>(`${this.runtime.apiUrl}/catalog/promotions/validate`, payload);
  }
}
