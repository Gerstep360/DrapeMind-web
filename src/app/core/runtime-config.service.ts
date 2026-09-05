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

  get apiUrl(): string {
    const prefix = this.config.apiPrefix ?? environment.apiPrefix;
    return `${this.backendUrl}${prefix}`;
  }

  wsUrl(channel: 'ai' | 'events'): string {
    const base = this.backendUrl || window.location.origin;
    const socketBase = base.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    const prefix = this.config.apiPrefix ?? environment.apiPrefix;
    return `${socketBase}${prefix}/ws/${channel}`;
  }

  resolveImageUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (/^(https?:|data:|blob:)/i.test(url)) return url;
    const clean = url.replace(/^\/+/, '');
    if (this.backendUrl) {
      return `${this.backendUrl}/${clean}`;
    }
    const base = typeof document !== 'undefined'
      ? (document.querySelector('base')?.getAttribute('href') || '/DrapeMind/')
      : '/DrapeMind/';
    const cleanBase = base.endsWith('/') ? base : `${base}/`;
    return `${cleanBase}${clean}`;
  }
}
