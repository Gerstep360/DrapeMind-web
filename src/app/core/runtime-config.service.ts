import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

interface RuntimeConfig {
  backendUrl?: string;
  apiPrefix?: string;
}

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  readonly loaded = signal(false);
  private config: RuntimeConfig = {};

  async load(): Promise<void> {
    try {
      const base = typeof document !== 'undefined'
        ? (document.querySelector('base')?.getAttribute('href') || '/')
        : '/';
      const cleanBase = base.endsWith('/') ? base : `${base}/`;
      const configUrl = `${cleanBase}config.json`;
      const response = await fetch(configUrl, { cache: 'no-store' });
      if (response.ok) {
        this.config = (await response.json()) as RuntimeConfig;
      }
    } catch {
      this.config = {};
    } finally {
      this.loaded.set(true);
    }
  }

  get backendUrl(): string {
    const configured = this.config.backendUrl ?? environment.backendUrl;
    return configured.replace(/\/$/, '');
  }

  private normalizePrefix(prefix: string): string {
    if (!this.backendUrl && typeof window !== 'undefined') {
      const path = window.location.pathname || '';
      const baseHref = typeof document !== 'undefined' ? (document.querySelector('base')?.getAttribute('href') || '') : '';
      const isSubpath = path.toLowerCase().startsWith('/drapemind') || baseHref.toLowerCase().includes('/drapemind');
      if (isSubpath && !prefix.toLowerCase().includes('/drapemind')) {
        const cleanPrefix = prefix.startsWith('/') ? prefix : `/${prefix}`;
        return `/DrapeMind${cleanPrefix}`;
      }
    }
    return prefix;
  }

  get apiUrl(): string {
    const rawPrefix = this.config.apiPrefix ?? environment.apiPrefix;
    const prefix = this.normalizePrefix(rawPrefix);
    return `${this.backendUrl}${prefix}`;
  }

  wsUrl(channel: 'ai' | 'events'): string {
    const base = this.backendUrl || window.location.origin;
    const socketBase = base.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    const rawPrefix = this.config.apiPrefix ?? environment.apiPrefix;
    const prefix = this.normalizePrefix(rawPrefix);
    return `${socketBase}${prefix}/ws/${channel}`;
  }

  resolveImageUrl(url: any): string | null {
    if (!url) return null;
    const str = typeof url === 'string' ? url : (url?.url || url?.src || '');
    if (!str || typeof str !== 'string') return null;
    if (/^(https?:|data:|blob:)/i.test(str)) return str;

    let clean = str.replace(/^\/+/, '');

    // Si es solo un nombre de archivo de imagen subido (ej. 'f53227296d92475084c3c0b4cbcf51c4.png')
    if (!clean.includes('/') && /\.(png|jpe?g|webp|svg|gif)$/i.test(clean)) {
      clean = `static/products/${clean}`;
    }

    if (this.backendUrl) {
      return `${this.backendUrl}/${clean}`;
    }

    const base = typeof document !== 'undefined'
      ? (document.querySelector('base')?.getAttribute('href') || '/DrapeMind/')
      : '/DrapeMind/';
    const cleanBase = base.endsWith('/') ? base : `${base}/`;

    // Evitar duplicación de prefijo si clean ya contiene drapemind/
    const baseSegment = cleanBase.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (baseSegment && clean.toLowerCase().startsWith(`${baseSegment}/`)) {
      return `/${clean}`;
    }

    return `${cleanBase}${clean}`;
  }
}
