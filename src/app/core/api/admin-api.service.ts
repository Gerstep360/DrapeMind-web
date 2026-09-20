import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AdminUserCreatePayload,
  AdminUserUpdatePayload,
  AiAnalyticsOverview,
  Branch,
  BranchInput,
  Category,
  CategoryInput,
  City,
  CityInput,
  ExecutiveReportRequest,
  ExecutiveReportResponse,
  Product,
  ProductAiAssistStudioRequest,
  ProductAiAssistStudioResponse,
  ProductVariant,
  ProductVariantPayload,
  Promotion,
  PromotionInput,
  SalesHistoryItem,
  Season,
  SeasonInput,
  Supplier,
  SupplierAccountInput,
  SupplierInput,
  SupplierProduct,
  SupplierProductInput,
  User,
} from '@core/models';
import { RuntimeConfigService } from '@core/runtime-config.service';

export interface ProductAiAssistResponse {
  titulo_comercial: string;
  descripcion_editorial: string;
  guia_cuidado: string;
  tags_estilo: string[];
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  // ==========================================
  // CU-27: Usuarios, Roles y Empleados
  // ==========================================
  listUsers(filters: { limit?: number; offset?: number; rol?: string; q?: string } = {}): Observable<User[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    });
    return this.http.get<User[]>(`${this.runtime.apiUrl}/admin/users`, { params });
  }

  createUser(payload: AdminUserCreatePayload): Observable<User> {
    return this.http.post<User>(`${this.runtime.apiUrl}/admin/users`, payload);
  }

  updateUser(id: number, payload: AdminUserUpdatePayload): Observable<User> {
    return this.http.patch<User>(`${this.runtime.apiUrl}/admin/users/${id}`, payload);
  }

  toggleUserStatus(id: number): Observable<{ message: string; estado: string }> {
    return this.http.delete<{ message: string; estado: string }>(`${this.runtime.apiUrl}/admin/users/${id}`);
  }

  // ==========================================
  // CU-28: Ciudades y Sucursales Físicas
  // ==========================================
  listCities(includeInactive = true): Observable<City[]> {
    return this.http.get<City[]>(`${this.runtime.apiUrl}/branches/cities`, {
      params: { include_inactive: includeInactive },
    });
  }

  createCity(payload: CityInput): Observable<City> {
    return this.http.post<City>(`${this.runtime.apiUrl}/branches/cities`, payload);
  }

  updateCity(id: number, payload: CityInput): Observable<City> {
    return this.http.put<City>(`${this.runtime.apiUrl}/branches/cities/${id}`, payload);
  }

  deleteCity(id: number): Observable<{ message: string; activo: boolean }> {
    return this.http.delete<{ message: string; activo: boolean }>(`${this.runtime.apiUrl}/branches/cities/${id}`);
  }

  listBranches(includeInactive = true, ciudadId?: number): Observable<Branch[]> {
    let params = new HttpParams().set('include_inactive', String(includeInactive));
    if (ciudadId) params = params.set('ciudad_id', String(ciudadId));
    return this.http.get<Branch[]>(`${this.runtime.apiUrl}/branches`, { params });
  }

  getBranch(id: number): Observable<Branch> {
    return this.http.get<Branch>(`${this.runtime.apiUrl}/branches/${id}`);
  }

  createBranch(payload: BranchInput): Observable<Branch> {
    return this.http.post<Branch>(`${this.runtime.apiUrl}/branches`, payload);
  }

  updateBranch(id: number, payload: BranchInput): Observable<Branch> {
    return this.http.put<Branch>(`${this.runtime.apiUrl}/branches/${id}`, payload);
  }

  deleteBranch(id: number): Observable<{ message: string; activo: boolean }> {
    return this.http.delete<{ message: string; activo: boolean }>(`${this.runtime.apiUrl}/branches/${id}`);
  }

  // ==========================================
  // CU-30: Categorías, Tallas, Colores y Variantes
  // ==========================================
  listCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.runtime.apiUrl}/catalog/categories`);
  }

  createCategory(payload: CategoryInput): Observable<Category> {
    return this.http.post<Category>(`${this.runtime.apiUrl}/admin/categories`, payload);
  }

  updateCategory(id: number, payload: CategoryInput): Observable<Category> {
    return this.http.put<Category>(`${this.runtime.apiUrl}/admin/categories/${id}`, payload);
  }

  deleteCategory(id: number): Observable<{ message: string; activo: boolean }> {
    return this.http.delete<{ message: string; activo: boolean }>(`${this.runtime.apiUrl}/admin/categories/${id}`);
  }

  listVariants(filters: { producto_id?: number; q?: string; activo_only?: boolean; limit?: number; offset?: number } = {}): Observable<ProductVariant[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    });
    return this.http.get<ProductVariant[]>(`${this.runtime.apiUrl}/admin/variants`, { params });
  }

  createVariant(productId: number, payload: ProductVariantPayload): Observable<ProductVariant> {
    return this.http.post<ProductVariant>(`${this.runtime.apiUrl}/admin/products/${productId}/variants`, payload);
  }

  updateVariant(variantId: number, payload: ProductVariantPayload): Observable<ProductVariant> {
    return this.http.put<ProductVariant>(`${this.runtime.apiUrl}/admin/variants/${variantId}`, payload);
  }

  deleteVariant(variantId: number): Observable<{ message: string; activo: boolean }> {
    return this.http.delete<{ message: string; activo: boolean }>(`${this.runtime.apiUrl}/admin/variants/${variantId}`);
  }

  // ==========================================
  // CU-29: Productos de Ropa
  // ==========================================
  listProducts(filters: { q?: string; categoria_id?: number; genero?: string; activo?: boolean; limit?: number; offset?: number } = {}): Observable<Product[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    });
    return this.http.get<Product[]>(`${this.runtime.apiUrl}/admin/products`, { params });
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.runtime.apiUrl}/admin/products/${id}`);
  }

  createProduct(payload: Partial<Product>): Observable<Product> {
    return this.http.post<Product>(`${this.runtime.apiUrl}/admin/products`, payload);
  }

  updateProduct(id: number, payload: Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`${this.runtime.apiUrl}/admin/products/${id}`, payload);
  }

  deleteProduct(id: number): Observable<{ message: string; activo: boolean }> {
    return this.http.delete<{ message: string; activo: boolean }>(`${this.runtime.apiUrl}/admin/products/${id}`);
  }

  uploadProductImage(file: File): Observable<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string; filename: string }>(`${this.runtime.apiUrl}/admin/products/upload-image`, formData);
  }

  assistProductDraft(data: { nombre_borrador: string; material?: string; estilo_objetivo?: string }): Observable<ProductAiAssistResponse> {
    return this.http.post<ProductAiAssistResponse>(`${this.runtime.apiUrl}/ai/products/assist-creation`, data);
  }

  // ==========================================
  // CU-32: Gestionar Proveedores
  // ==========================================
  listSuppliers(filters: { q?: string; ciudad?: string; activo?: boolean } = {}): Observable<Supplier[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    });
    return this.http.get<Supplier[]>(`${this.runtime.apiUrl}/admin/suppliers`, { params });
  }

  getSupplier(id: number): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.runtime.apiUrl}/admin/suppliers/${id}`);
  }

  createSupplier(payload: SupplierInput): Observable<Supplier> {
    return this.http.post<Supplier>(`${this.runtime.apiUrl}/admin/suppliers`, payload);
  }

  updateSupplier(id: number, payload: SupplierInput): Observable<Supplier> {
    return this.http.put<Supplier>(`${this.runtime.apiUrl}/admin/suppliers/${id}`, payload);
  }

  deleteSupplier(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.runtime.apiUrl}/admin/suppliers/${id}`);
  }

  createSupplierAccount(supplierId: number, payload: SupplierAccountInput): Observable<Supplier> {
    return this.http.post<Supplier>(`${this.runtime.apiUrl}/admin/suppliers/${supplierId}/account`, payload);
  }

  unlinkSupplierAccount(supplierId: number): Observable<Supplier> {
    return this.http.delete<Supplier>(`${this.runtime.apiUrl}/admin/suppliers/${supplierId}/account`);
  }

  getMySupplierProfile(): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.runtime.apiUrl}/admin/suppliers/me/profile`);
  }

  getMySupplierProducts(): Observable<SupplierProduct[]> {
    return this.http.get<SupplierProduct[]>(`${this.runtime.apiUrl}/admin/suppliers/me/products`);
  }

  createMySupplierProduct(payload: SupplierProductInput): Observable<SupplierProduct> {
    return this.http.post<SupplierProduct>(`${this.runtime.apiUrl}/admin/suppliers/me/products`, payload);
  }

  updateMySupplierProduct(productId: number, payload: SupplierProductInput): Observable<SupplierProduct> {
    return this.http.put<SupplierProduct>(`${this.runtime.apiUrl}/admin/suppliers/me/products/${productId}`, payload);
  }

  deleteMySupplierProduct(productId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.runtime.apiUrl}/admin/suppliers/me/products/${productId}`);
  }

  // ==========================================
  // CU-36: Gestionar Promociones
  // ==========================================
  listPromotions(activo?: boolean): Observable<Promotion[]> {
    let params = new HttpParams();
    if (activo !== undefined) params = params.set('activo', String(activo));
    return this.http.get<Promotion[]>(`${this.runtime.apiUrl}/admin/promotions`, { params });
  }

  getPromotion(id: number): Observable<Promotion> {
    return this.http.get<Promotion>(`${this.runtime.apiUrl}/admin/promotions/${id}`);
  }

  createPromotion(payload: PromotionInput): Observable<Promotion> {
    return this.http.post<Promotion>(`${this.runtime.apiUrl}/admin/promotions`, payload);
  }

  updatePromotion(id: number, payload: PromotionInput): Observable<Promotion> {
    return this.http.put<Promotion>(`${this.runtime.apiUrl}/admin/promotions/${id}`, payload);
  }

  deletePromotion(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.runtime.apiUrl}/admin/promotions/${id}`);
  }

  validatePromotion(codigo: string, subtotal: number): Observable<{
    valido: boolean;
    codigo: string;
    mensaje: string;
    tipo_descuento?: string;
    valor_descuento?: number;
    descuento_calculado: number;
  }> {
    return this.http.post<any>(`${this.runtime.apiUrl}/catalog/promotions/validate`, {
      codigo,
      monto_subtotal: subtotal,
    });
  }

  // ==========================================
  // CU-31: Gestionar Temporadas y Colecciones
  // ==========================================
  listSeasons(activo?: boolean): Observable<Season[]> {
    let params = new HttpParams();
    if (activo !== undefined) params = params.set('activo', String(activo));
    return this.http.get<Season[]>(`${this.runtime.apiUrl}/admin/collections`, { params });
  }

  getSeason(id: number): Observable<Season> {
    return this.http.get<Season>(`${this.runtime.apiUrl}/admin/collections/${id}`);
  }

  createSeason(payload: SeasonInput): Observable<Season> {
    return this.http.post<Season>(`${this.runtime.apiUrl}/admin/collections`, payload);
  }

  updateSeason(id: number, payload: SeasonInput): Observable<Season> {
    return this.http.put<Season>(`${this.runtime.apiUrl}/admin/collections/${id}`, payload);
  }

  deleteSeason(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.runtime.apiUrl}/admin/collections/${id}`);
  }

  // ==========================================
  // CU-25: Estudio Autónomo de Producto con IA
  // ==========================================
  assistProductStudio(req: ProductAiAssistStudioRequest): Observable<ProductAiAssistStudioResponse> {
    return this.http.post<ProductAiAssistStudioResponse>(`${this.runtime.apiUrl}/ai/products/assist-studio`, req);
  }

  // ==========================================
  // CU-26: Generar Reportes Empresariales con IA
  // ==========================================
  generateExecutiveReport(req: ExecutiveReportRequest): Observable<ExecutiveReportResponse> {
    return this.http.post<ExecutiveReportResponse>(`${this.runtime.apiUrl}/ai/reports/generate`, req);
  }

  getExecutiveReportSummary(): Observable<any> {
    return this.http.post<any>(`${this.runtime.apiUrl}/ai/reports/executive-summary`, {});
  }

  // ==========================================
  // CU-33: Registrar Suministros de Proveedor
  // ==========================================
  listSupplierProducts(supplierId: number): Observable<SupplierProduct[]> {
    return this.http.get<SupplierProduct[]>(`${this.runtime.apiUrl}/admin/suppliers/${supplierId}/products`);
  }

  createSupplierProduct(supplierId: number, payload: SupplierProductInput): Observable<SupplierProduct> {
    return this.http.post<SupplierProduct>(`${this.runtime.apiUrl}/admin/suppliers/${supplierId}/products`, payload);
  }

  updateSupplierProduct(supplierId: number, productId: number, payload: SupplierProductInput): Observable<SupplierProduct> {
    return this.http.put<SupplierProduct>(`${this.runtime.apiUrl}/admin/suppliers/${supplierId}/products/${productId}`, payload);
  }

  deleteSupplierProduct(supplierId: number, productId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.runtime.apiUrl}/admin/suppliers/${supplierId}/products/${productId}`);
  }

  listAllSupplierProducts(filters: { q?: string; categoria?: string; proveedor_id?: number } = {}): Observable<SupplierProduct[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    });
    return this.http.get<SupplierProduct[]>(`${this.runtime.apiUrl}/admin/suppliers/products/all`, { params });
  }

  // ==========================================
  // CU-40: Historial, Indicadores y Métricas IA
  // ==========================================
  getCommercialDashboard(): Observable<{
    total_ventas: number;
    total_pedidos: number;
    total_usuarios: number;
    total_productos: number;
    pedidos_por_estado: Record<string, number>;
  }> {
    return this.http.get<any>(`${this.runtime.apiUrl}/admin/dashboard`);
  }

  getAiAnalytics(limit = 30): Observable<AiAnalyticsOverview> {
    return this.http.get<AiAnalyticsOverview>(`${this.runtime.apiUrl}/admin/ai/analytics`, {
      params: { limit },
    });
  }

  getSalesHistory(limit = 100): Observable<SalesHistoryItem[]> {
    return this.http.get<SalesHistoryItem[]>(`${this.runtime.apiUrl}/admin/sales/history`, {
      params: { limit },
    });
  }

  getSalesInventoryMetrics(): Observable<{
    ventas: { pedidos_entregados: number; ingresos: number };
    inventario: { variantes: number; unidades_disponibles: number; stock_bajo: number };
  }> {
    return this.http.get<any>(`${this.runtime.apiUrl}/admin/metrics/sales-inventory`);
  }

  getAiTypeMetrics(): Observable<Array<{ tipo: string; total: number; duracion_promedio_ms: number }>> {
    return this.http.get<any[]>(`${this.runtime.apiUrl}/admin/metrics/ai`);
  }
}


