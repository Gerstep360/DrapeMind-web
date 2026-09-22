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
      let cleanBase = base.endsWith('/') ? base : `${base}/`;

      if (typeof window !== 'undefined') {
        const path = window.location.pathname || '';
        if (path.toLowerCase().startsWith('/drapemind') && !cleanBase.toLowerCase().includes('/drapemind')) {
          cleanBase = '/DrapeMind/';
        }
      }

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

    let clean = str.replace(/\\/g, '/').replace(/^\/+/, '');

    // Normalizar si ya viene con prefijo drapemind/
    if (clean.toLowerCase().startsWith('drapemind/')) {
      clean = clean.substring('drapemind/'.length).replace(/^\/+/, '');
    }

    // Si es solo un nombre de archivo de imagen subido (ej. 'f53227296d92475084c3c0b4cbcf51c4.png')
    if (!clean.includes('/') && /\.(png|jpe?g|webp|svg|gif)$/i.test(clean)) {
      clean = `static/products/${clean}`;
    } else if (!clean.startsWith('static/') && /\.(png|jpe?g|webp|svg|gif)$/i.test(clean)) {
      clean = `static/${clean}`;
    }

    if (this.backendUrl) {
      return `${this.backendUrl}/${clean}`;
    }

    const isSubpath = typeof window !== 'undefined' &&
      window.location.pathname.toLowerCase().includes('/drapemind');
    const prefix = isSubpath ? '/DrapeMind/' : '/';

    return `${prefix}${clean}`;
  }
}
