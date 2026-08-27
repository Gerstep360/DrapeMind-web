import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Address,
  AddressInput,
  AiRuntimeStatus,
  Cart,
  Category,
  CheckoutRequest,
  Order,
  Payment,
  PaymentCreate,
  Product,
  Reservation,
  SalesInventoryMetrics,
} from './models';
import { RuntimeConfigService } from './runtime-config.service';

@Injectable({ providedIn: 'root' })
export class StoreApiService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  categories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.runtime.apiUrl}/catalog/categories`);
  }

  products(
    filters: Record<string, string | number | boolean | null | undefined> = {},
  ): Observable<Product[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<Product[]>(`${this.runtime.apiUrl}/catalog/products`, { params });
  }

  product(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.runtime.apiUrl}/catalog/products/${id}`);
  }

  createProduct(payload: Partial<Product>): Observable<Product> {
    return this.http.post<Product>(`${this.runtime.apiUrl}/admin/products`, payload);
  }

  updateProduct(id: number, payload: Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`${this.runtime.apiUrl}/admin/products/${id}`, payload);
  }

  createVariant(productId: number, payload: Partial<ProductVariantPayload>): Observable<unknown> {
    return this.http.post(`${this.runtime.apiUrl}/admin/products/${productId}/variants`, payload);
  }

  adjustInventory(
    variante_id: number,
    nuevo_stock_total: number,
    observacion: string,
  ): Observable<unknown> {
    return this.http.post(`${this.runtime.apiUrl}/admin/inventory/adjustments`, {
      variante_id,
      nuevo_stock_total,
      observacion,
    });
  }

  reservations(state?: string): Observable<Reservation[]> {
    const params = state ? new HttpParams().set('state', state) : undefined;
    return this.http.get<Reservation[]>(`${this.runtime.apiUrl}/admin/reservations`, { params });
  }

  myReservations(): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(`${this.runtime.apiUrl}/reservations`);
  }

  validateQr(qr_token: string): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.runtime.apiUrl}/reservations/validate-qr`, {
      qr_token,
    });
  }

  convertReservation(id: number): Observable<Order> {
    return this.http.post<Order>(`${this.runtime.apiUrl}/reservations/${id}/convert-to-order`, {});
  }

  orders(state?: string): Observable<Order[]> {
    const params = state ? new HttpParams().set('state', state) : undefined;
    return this.http.get<Order[]>(`${this.runtime.apiUrl}/admin/orders`, { params });
  }

  myOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.runtime.apiUrl}/orders`);
  }

  updateOrderStatus(id: number, estado: string): Observable<Order> {
    return this.http.patch<Order>(`${this.runtime.apiUrl}/orders/${id}/status`, { estado });
  }

  confirmCashPayment(id: number): Observable<Order> {
    return this.http.post<Order>(`${this.runtime.apiUrl}/orders/${id}/cash-confirm`, {});
  }

  getCart(): Observable<Cart> {
    return this.http.get<Cart>(`${this.runtime.apiUrl}/cart`);
  }

  addCartItem(variante_id: number, cantidad = 1): Observable<Cart> {
    return this.http.post<Cart>(`${this.runtime.apiUrl}/cart/items`, { variante_id, cantidad });
  }

  addCartItemsBatch(items: Array<{ variante_id: number; cantidad: number }>): Observable<Cart> {
    return this.http.post<Cart>(`${this.runtime.apiUrl}/cart/items/batch`, { items });
  }

  replaceCartItemsBatch(items: Array<{ variante_id: number; cantidad: number }>): Observable<Cart> {
    return this.http.put<Cart>(`${this.runtime.apiUrl}/cart/items/batch`, { items });
  }

  updateCartItem(item_id: number, cantidad: number): Observable<Cart> {
    return this.http.patch<Cart>(`${this.runtime.apiUrl}/cart/items/${item_id}`, { cantidad });
  }

  deleteCartItem(item_id: number): Observable<Cart> {
    return this.http.delete<Cart>(`${this.runtime.apiUrl}/cart/items/${item_id}`);
  }

  checkout(payload: CheckoutRequest): Observable<Order> {
    return this.http.post<Order>(`${this.runtime.apiUrl}/orders/checkout`, payload);
  }

  initiatePayment(payload: PaymentCreate): Observable<Payment> {
    return this.http.post<Payment>(`${this.runtime.apiUrl}/payments`, payload);
  }

  mockConfirmPayment(payment_id: number): Observable<Payment> {
    return this.http.post<Payment>(`${this.runtime.apiUrl}/payments/${payment_id}/mock-confirm`, {});
  }

  myAddresses(): Observable<Address[]> {
    return this.http.get<Address[]>(`${this.runtime.apiUrl}/users/me/addresses`);
  }

  createAddress(payload: AddressInput): Observable<Address> {
    return this.http.post<Address>(`${this.runtime.apiUrl}/users/me/addresses`, payload);
  }

  deleteAddress(address_id: number): Observable<void> {
    return this.http.delete<void>(`${this.runtime.apiUrl}/users/me/addresses/${address_id}`);
  }

  metrics(): Observable<SalesInventoryMetrics> {
    return this.http.get<SalesInventoryMetrics>(
      `${this.runtime.apiUrl}/admin/metrics/sales-inventory`,
    );
  }

  aiMetrics(): Observable<Array<Record<string, unknown>>> {
    return this.http.get<Array<Record<string, unknown>>>(`${this.runtime.apiUrl}/admin/metrics/ai`);
  }

  aiRuntime(): Observable<AiRuntimeStatus> {
    return this.http.get<AiRuntimeStatus>(`${this.runtime.apiUrl}/admin/ai/runtime`);
  }

  startAi(): Observable<AiRuntimeStatus> {
    return this.http.post<AiRuntimeStatus>(`${this.runtime.apiUrl}/admin/ai/runtime/start`, {});
  }

  stopAi(): Observable<AiRuntimeStatus> {
    return this.http.post<AiRuntimeStatus>(`${this.runtime.apiUrl}/admin/ai/runtime/stop`, {});
  }
}

export interface ProductVariantPayload {
  sku: string;
  color: string;
  codigo_color?: string;
  talla: string;
  stock_total: number;
  codigo_barras?: string;
  imagen?: string;
  activo: boolean;
}
