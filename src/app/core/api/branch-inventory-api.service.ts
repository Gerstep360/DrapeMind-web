import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Branch, BranchStock, InventoryMovement } from '@core/models';
import { RuntimeConfigService } from '@core/runtime-config.service';

@Injectable({ providedIn: 'root' })
export class BranchInventoryApiService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  branches(): Observable<Branch[]> { return this.http.get<Branch[]>(`${this.runtime.apiUrl}/branches`); }
  branchStock(id: number): Observable<BranchStock[]> {
    return this.http.get<BranchStock[]>(`${this.runtime.apiUrl}/branches/${id}/availability`, { params: { con_stock: false } });
  }
  branchAvailability(id: number): Observable<BranchStock[]> { return this.branchStock(id); }
  assignedBranches(): Observable<Branch[]> { return this.http.get<Branch[]>(`${this.runtime.apiUrl}/branches/staff/assigned`); }
  branchMovements(id: number): Observable<InventoryMovement[]> { return this.http.get<InventoryMovement[]>(`${this.runtime.apiUrl}/branches/${id}/movements`); }
  setBranchStock(id: number, variantId: number, total: number, observation: string): Observable<BranchStock> {
    return this.http.put<BranchStock>(`${this.runtime.apiUrl}/branches/${id}/stock`, { variante_id: variantId, stock_total: total, activo: true }, { params: { observacion: observation } });
  }
  adjustInventory(variante_id: number, nuevo_stock_total: number, observacion: string, sucursal_id?: number | null, tipo?: 'ENTRADA' | 'AJUSTE' | null): Observable<unknown> {
    return this.http.post(`${this.runtime.apiUrl}/admin/inventory/adjustments`, { variante_id, nuevo_stock_total, observacion, sucursal_id, tipo });
  }
  adminInventoryMovements(filters: { tipo?: string; sucursal_id?: number; variante_id?: number; limit?: number } = {}): Observable<InventoryMovement[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== null && value !== undefined && value !== '') params = params.set(key, String(value)); });
    return this.http.get<InventoryMovement[]>(`${this.runtime.apiUrl}/admin/inventory/movements`, { params });
  }
}
