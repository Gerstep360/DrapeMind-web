import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  show(message: string, tone: Toast['tone'] = 'info'): void {
    const toast = { id: this.nextId++, message, tone };
    this.toasts.update((items) => [...items, toast]);
    window.setTimeout(() => this.dismiss(toast.id), 4200);
  }

  dismiss(id: number): void {
    this.toasts.update((items) => items.filter((item) => item.id !== id));
  }
}
