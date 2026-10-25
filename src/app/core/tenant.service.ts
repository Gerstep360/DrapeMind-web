import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TenantService {
  readonly slug = signal(localStorage.getItem('drapemind_company') || 'drapemind');
  readonly entrySlug = signal<string | null>(null);
  readonly name = signal<string | null>(null);
  enterStore(slug: string): void {
    this.select(slug);
    this.entrySlug.set(this.slug());
  }
  useAccount(slug: string | null | undefined, name?: string | null): void {
    this.name.set(name || null);
    if (slug) this.select(slug);
    else {
      this.slug.set('');
      localStorage.removeItem('drapemind_company');
    }
    this.entrySlug.set(null);
  }
  select(slug: string): void {
    const normalized = slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized))
      throw new Error('Identificador de empresa inválido');
    this.slug.set(normalized);
    localStorage.setItem('drapemind_company', normalized);
  }
}
