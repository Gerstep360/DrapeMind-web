import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Order, Reservation } from '@core/models';
import { RuntimeConfigService } from '@core/runtime-config.service';

@Injectable({ providedIn: 'root' })
export class ReservationsApiService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  reservations(state?: string, branchId?: number): Observable<Reservation[]> {
    let params = new HttpParams();
    if (state) params = params.set('state', state);
    if (branchId) params = params.set('sucursal_id', branchId);
    return this.http.get<Reservation[]>(`${this.runtime.apiUrl}/admin/reservations`, { params });
  }
  myReservations(): Observable<Reservation[]> { return this.http.get<Reservation[]>(`${this.runtime.apiUrl}/reservations`); }
  reservation(id: number): Observable<Reservation> { return this.http.get<Reservation>(`${this.runtime.apiUrl}/reservations/${id}`); }
  createReservation(sucursal_id: number, items: Array<{ variante_id: number; cantidad: number }>, observacion?: string): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.runtime.apiUrl}/reservations`, { sucursal_id, items, observacion: observacion || null });
  }
  cancelReservation(id: number): Observable<Reservation> { return this.http.post<Reservation>(`${this.runtime.apiUrl}/reservations/${id}/cancel`, {}); }
  reservationQr(id: number): Observable<Blob> { return this.http.get(`${this.runtime.apiUrl}/reservations/${id}/qr`, { responseType: 'blob' }); }
  prepareReservation(id: number): Observable<Reservation> { return this.http.post<Reservation>(`${this.runtime.apiUrl}/reservations/${id}/prepare`, {}); }
  markReservationReady(id: number): Observable<Reservation> { return this.http.post<Reservation>(`${this.runtime.apiUrl}/reservations/${id}/ready`, {}); }
  validateQr(qr_token: string): Observable<Reservation> { return this.http.post<Reservation>(`${this.runtime.apiUrl}/reservations/validate-qr`, { qr_token }); }
  convertReservation(id: number): Observable<Order> { return this.http.post<Order>(`${this.runtime.apiUrl}/reservations/${id}/convert-to-order`, {}); }
}
