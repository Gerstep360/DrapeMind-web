import { DownloadedOrdersService } from '../cu24_pedidos/cu24-pedidos-descargados.service';
import { firstValueFrom } from 'rxjs';
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OfflineService, offlineMessage } from '../cu13_catalogo_offline/cu13-offline.service';
import { DeferredCheckoutService } from '../cu23_pagos/cu23-deferred-checkout.service';
import { CartService } from '../../core/cart.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-store-download',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <button
      class="store-download-trigger"
      type="button"
      (click)="open.set(!open())"
      aria-label="Datos de esta tienda sin conexión"
      [attr.aria-expanded]="open()"
      [title]="offline.bundle() ? 'Tienda descargada para uso sin conexión' : 'Descargar tienda offline'"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      @if (offline.bundle()) {
        <span class="active-dot" title="Catálogo guardado localmente"></span>
      }
      @if (count()) {
        <span class="count-badge">{{ count() }}</span>
      }
    </button>

    @if (open()) {
      <div class="panel-backdrop" (click)="open.set(false)"></div>
      <section class="download-panel" role="dialog" aria-label="Tu tienda sin Internet" (keydown.escape)="open.set(false)">
        <header class="panel-header">
          <div class="panel-title-group">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <h2>Modo Sin Conexión</h2>
          </div>
          <button type="button" class="btn-close" (click)="open.set(false)" aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </header>

        <div class="panel-body">
          @if (offline.bundle(); as saved) {
            <div class="status-banner is-saved">
              <div class="status-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                <span>CATÁLOGO SINCRONIZADO</span>
              </div>
              <p class="status-meta">
                <strong>{{ saved.products.length }} prendas</strong> guardadas en este navegador · {{ saved.downloaded_at | date: 'd MMM, HH:mm' }}
              </p>
              <p class="status-note">
                Puedes navegar la tienda y seleccionar prendas aun si pierdes tu conexión a Internet.
              </p>
            </div>
          } @else {
            <div class="status-banner is-empty">
              <p class="status-heading">Descarga esta tienda en tu navegador</p>
              <p class="status-note">
                Guarda el catálogo completo, fotos y stock en tu dispositivo para navegar y tramitar compras o reservas sin señal.
              </p>
            </div>
          }

          @if (busy()) {
            <div class="progress-wrap">
              <div class="spinner-line"></div>
              <p class="progress-text">{{ offline.phase() || 'Descargando datos y prendas de la tienda…' }}</p>
            </div>
          }

          @if (error()) {
            <div class="alert-box" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>{{ error() }}</span>
            </div>
          }

          <div class="panel-actions">
            <button
              class="btn-primary-action"
              type="button"
              [disabled]="busy()"
              (click)="download()"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>{{ busy() ? 'Descargando catálogo…' : (offline.bundle() ? 'Actualizar descarga' : 'Descargar tienda ahora') }}</span>
            </button>

            @if (offline.bundle()) {
              <a
                routerLink="/offline"
                class="btn-secondary-action"
                (click)="open.set(false)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                <span>Explorar catálogo sin conexión</span>
              </a>
            }
          </div>

          @if (!connected()) {
            <p class="offline-warning">
              Actualmente estás sin señal. Estás utilizando los datos guardados localmente.
            </p>
          }

          @if (count()) {
            <div class="pending-notice">
              <span>Tienes <strong>{{ count() }}</strong> operaciones por sincronizar.</span>
              <a routerLink="/orders" (click)="open.set(false)">Ver mis pedidos</a>
            </div>
          }
        </div>
      </section>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        position: relative;
      }
      .store-download-trigger {
        position: relative;
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border: 2px solid #151515;
        border-radius: 50%;
        color: #151515;
        background: #fff;
        box-shadow: 2px 2px 0 #151515;
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .store-download-trigger:hover {
        transform: translate(-1px, -1px);
        box-shadow: 3px 3px 0 #151515;
        background: #faf8f5;
      }
      .active-dot {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #2b8a3e;
        border: 2px solid #fff;
      }
      .count-badge {
        position: absolute;
        bottom: -4px;
        right: -4px;
        font-size: 10px;
        font-weight: 800;
        background: #c8ff2a;
        color: #151515;
        border: 1.5px solid #151515;
        border-radius: 10px;
        padding: 1px 5px;
      }
      .panel-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        z-index: 99998;
        backdrop-filter: blur(4px);
      }
      .download-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 99999;
        width: min(450px, calc(100vw - 32px));
        max-height: 90vh;
        overflow-y: auto;
        background: #fffdf9;
        border: 3px solid #151515;
        border-radius: 16px;
        box-shadow: 8px 8px 0 #151515;
        color: #151515;
        text-align: left;
        font-family: inherit;
        animation: panelCenterIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes panelCenterIn {
        from {
          opacity: 0;
          transform: translate(-50%, -46%) scale(0.96);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
      }
      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 2px solid #151515;
        background: #fbf9f4;
      }
      .panel-title-group {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .panel-title-group h2 {
        font-size: 17px;
        font-weight: 800;
        margin: 0;
        letter-spacing: -0.02em;
      }
      .btn-close {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border: 2px solid #151515;
        background: #fff;
        cursor: pointer;
        box-shadow: 2px 2px 0 #151515;
      }
      .btn-close:hover {
        background: #fee2e2;
      }
      .panel-body {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .status-banner {
        padding: 14px 16px;
        border: 2px solid #151515;
      }
      .status-banner.is-saved {
        background: #eefceb;
      }
      .status-banner.is-empty {
        background: #f7f5ee;
      }
      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0.05em;
        color: #1b6329;
        margin-bottom: 6px;
      }
      .status-heading {
        font-weight: 800;
        font-size: 15px;
        margin: 0 0 4px;
      }
      .status-meta {
        font-size: 13px;
        margin: 0 0 6px;
        color: #222;
      }
      .status-note {
        font-size: 12px;
        margin: 0;
        color: #555;
        line-height: 1.45;
      }
      .progress-wrap {
        padding: 10px 0;
      }
      .spinner-line {
        height: 4px;
        background: #151515;
        border-radius: 2px;
        animation: indeterminate 1.4s infinite ease-in-out;
      }
      @keyframes indeterminate {
        0% {
          transform: translateX(-100%);
        }
        50% {
          transform: translateX(10%);
        }
        100% {
          transform: translateX(100%);
        }
      }
      .progress-text {
        font-size: 12px;
        font-weight: 700;
        margin: 8px 0 0;
        color: #151515;
      }
      .alert-box {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: #ffe3e3;
        border: 2px solid #c92a2a;
        color: #a51d24;
        font-size: 12px;
        font-weight: 600;
      }
      .panel-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .btn-primary-action {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 44px;
        padding: 10px 16px;
        background: #c8ff2a;
        color: #151515;
        border: 2px solid #151515;
        box-shadow: 3px 3px 0 #151515;
        font-weight: 800;
        font-size: 14px;
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .btn-primary-action:hover:not(:disabled) {
        transform: translate(-1px, -1px);
        box-shadow: 4px 4px 0 #151515;
      }
      .btn-primary-action:disabled {
        opacity: 0.6;
        cursor: wait;
      }
      .btn-secondary-action {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 40px;
        padding: 8px 14px;
        background: #fff;
        color: #151515;
        border: 2px solid #151515;
        box-shadow: 3px 3px 0 #151515;
        font-weight: 700;
        font-size: 13px;
        text-decoration: none;
      }
      .btn-secondary-action:hover {
        background: #f5f3eb;
      }
      .offline-warning {
        font-size: 12px;
        color: #b04a00;
        background: #fff4e6;
        padding: 8px 12px;
        border: 1.5px solid #d9480f;
        margin: 0;
      }
      .pending-notice {
        font-size: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px dashed #ccc;
        padding-top: 10px;
      }
      .pending-notice a {
        font-weight: 800;
        color: #151515;
        text-decoration: underline;
      }
      @media (max-width: 600px) {
        .download-panel {
          width: calc(100vw - 24px);
          max-height: 92vh;
        }
      }
    `,
  ],
})
export class StoreDownloadComponent {
  private orders = inject(DownloadedOrdersService);
  readonly offline = inject(OfflineService);
  private deferred = inject(DeferredCheckoutService);
  private cart = inject(CartService);
  private auth = inject(AuthService);

  readonly open = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  readonly count = computed(
    () =>
      this.offline.pending() +
      this.deferred.purchases().filter((p) => !this.deferred.isTerminal(p)).length,
  );

  connected() {
    return navigator.onLine;
  }

  async download() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.offline.download();
      if (!this.offline.usable()) {
        throw new Error(this.offline.message() || 'No pudimos completar la descarga del catálogo.');
      }
      this.offline.online.set(true);
      try {
        await this.cart.prepareDownload();
      } catch (_) {}
      try {
        await firstValueFrom(this.orders.list());
      } catch (_) {}
      if (this.auth.user()?.rol === 'CLIENTE') {
        try {
          await this.deferred.refresh();
        } catch (_) {}
      }
    } catch (error) {
      this.error.set(offlineMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
