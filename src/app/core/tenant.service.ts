import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TenantService {
  readonly slug = signal(localStorage.getItem('drapemind_company') || 'drapemind');
  select(slug: string): void {
    const normalized = slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized))
      throw new Error('Identificador de empresa inválido');
    this.slug.set(normalized);
    localStorage.setItem('drapemind_company', normalized);
  }
}
