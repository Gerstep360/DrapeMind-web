import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Address, AddressInput, User } from '@core/models';
import { RuntimeConfigService } from '@core/runtime-config.service';

@Injectable({ providedIn: 'root' })
export class AccountApiService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);
  myAddresses(): Observable<Address[]> { return this.http.get<Address[]>(`${this.runtime.apiUrl}/users/me/addresses`); }
  updateMe(payload: { nombre?: string; telefono?: string | null }): Observable<User> { return this.http.patch<User>(`${this.runtime.apiUrl}/users/me`, payload); }
  createAddress(payload: AddressInput): Observable<Address> { return this.http.post<Address>(`${this.runtime.apiUrl}/users/me/addresses`, payload); }
  updateAddress(addressId: number, payload: AddressInput): Observable<Address> { return this.http.put<Address>(`${this.runtime.apiUrl}/users/me/addresses/${addressId}`, payload); }
  deleteAddress(addressId: number): Observable<void> { return this.http.delete<void>(`${this.runtime.apiUrl}/users/me/addresses/${addressId}`); }
}
