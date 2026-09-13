import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BranchStock, Category, Product, ProductVariantPayload } from '@core/models';
import { RuntimeConfigService } from '@core/runtime-config.service';

@Injectable({ providedIn: 'root' })
export class CatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  categories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.runtime.apiUrl}/catalog/categories`);
  }

  products(filters: Record<string, string | number | boolean | null | undefined> = {}): Observable<Product[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      const paramKey = key === 'gender' ? 'genero' : key === 'max_price' ? 'precio_max' : key;
      params = params.set(paramKey, String(value));
    });
    return this.http.get<Product[]>(`${this.runtime.apiUrl}/catalog/products`, { params });
  }

  product(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.runtime.apiUrl}/catalog/products/${id}`);
  }

  favorites(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.runtime.apiUrl}/catalog/favorites`);
  }

  addFavorite(productId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.runtime.apiUrl}/catalog/favorites/${productId}`, {});
  }

  removeFavorite(productId: number): Observable<void> {
    return this.http.delete<void>(`${this.runtime.apiUrl}/catalog/favorites/${productId}`);
  }

  productAvailability(productId: number): Observable<BranchStock[]> {
    return this.http.get<BranchStock[]>(`${this.runtime.apiUrl}/branches/products/${productId}/availability`);
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
}
