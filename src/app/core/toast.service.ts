import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
  url?: string;
  actionLabel?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  show(
    message: string,
    tone: Toast['tone'] = 'info',
    url?: string,
    actionLabel?: string,
  ): void {
    const toast: Toast = { id: this.nextId++, message, tone, url, actionLabel };
    this.toasts.update((items) => [...items, toast]);
    window.setTimeout(() => this.dismiss(toast.id), 5000);
  }

  dismiss(id: number): void {
    this.toasts.update((items) => items.filter((item) => item.id !== id));
  }
}
