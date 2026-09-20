import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommerceApiService } from '@core/api/commerce-api.service';
import { CartService } from '@core/cart.service';
import { RuntimeConfigService } from '@core/runtime-config.service';
import { ToastService } from '@core/toast.service';
import { garmentPresentationType } from '@shared/presentation/garment-presentation';

@Component({
  selector: 'app-cart-optimizer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cart-optimizer.component.html',
  styleUrl: './cart-optimizer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartOptimizerComponent implements OnInit {
  readonly cart = inject(CartService);
  readonly runtime = inject(RuntimeConfigService);
  private readonly commerceApi = inject(CommerceApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly activeTab = signal<'STYLE' | 'VALUE'>('STYLE');

  // CU-22: Estilo
  readonly analyzingStyle = signal<boolean>(false);
  readonly styleResult = signal<{ respuesta: string; productos: any[] } | null>(null);

  // CU-23: Valor y Ahorro
  readonly optimizingValue = signal<boolean>(false);
  readonly valueResult = signal<{ respuesta: string; productos: any[]; recomendaciones?: any[] } | null>(null);
  readonly applyingReplacement = signal<number | null>(null);

  ngOnInit(): void {
    if (this.cart.totalItems() === 0) {
      this.cart.loadCart();
    }
  }

  getGarmentType(name: string): string {
    return garmentPresentationType(name);
  }

  hasRealImage(url?: string | null): boolean {
    return !!url && !url.includes('placeholder') && !url.includes('assets/placeholder');
  }

  // CU-22: Ejecutar análisis de estilo
  runStyleAnalysis(): void {
    if (this.cart.totalItems() === 0 || this.analyzingStyle()) return;
    this.analyzingStyle.set(true);
    this.commerceApi
      .analyzeCartStyle({
        objetivo: 'Evaluar coherencia cromática, armonía formal y balance de ocasión del perchero',
      })
      .subscribe({
        next: (res) => {
          this.styleResult.set(res);
          this.analyzingStyle.set(false);
          this.toast.show('Auditoría estilística completada por Altair', 'success');
        },
        error: (err) => {
          this.toast.show(
            err.error?.detail || 'Error temporal al consultar el estilista IA',
            'error',
          );
          this.analyzingStyle.set(false);
        },
      });
  }

  // CU-23: Ejecutar optimización de valor
  runValueOptimization(): void {
    if (this.cart.totalItems() === 0 || this.optimizingValue()) return;
    this.optimizingValue.set(true);
    this.commerceApi
      .optimizeCartValue({
        objetivo: 'Optimizar calidad de materiales, balance costo/beneficio y ahorro en el perchero',
      })
      .subscribe({
        next: (res) => {
          this.valueResult.set(res);
          this.optimizingValue.set(false);
          this.toast.show('Cálculo de optimización y valor completado', 'success');
        },
        error: (err) => {
          this.toast.show(
            err.error?.detail || 'Error temporal al consultar optimización de ahorro',
            'error',
          );
          this.optimizingValue.set(false);
        },
      });
  }

  // CU-24: Aplicar recomendación de reemplazo inteligente
  applyReplacement(rec: any): void {
    if (!rec.id || this.applyingReplacement()) return;
    this.applyingReplacement.set(rec.id);
    this.commerceApi.applyRecommendation(rec.id).subscribe({
      next: (updatedCart) => {
        this.cart.setCart(updatedCart);
        this.applyingReplacement.set(null);
        this.toast.show(
          `Prenda reemplazada con éxito. ¡Ahorraste Bs ${rec.ahorro}!`,
          'success',
        );
        // Filtrar la recomendación aplicada
        if (this.valueResult()) {
          const current = this.valueResult()!;
          const updatedRecs = (current.recomendaciones || []).filter(
            (r: any) => r.id !== rec.id,
          );
          this.valueResult.set({ ...current, recomendaciones: updatedRecs });
        }
      },
      error: (err) => {
        this.applyingReplacement.set(null);
        this.toast.show(
          err.error?.detail || 'No se pudo aplicar el reemplazo al carrito',
          'error',
        );
      },
    });
  }

  addSuggestedToCart(item: any): void {
    const variantId = item.variantes?.[0]?.id || item.variante_id || item.id;
    if (variantId) {
      this.cart.addItem(variantId, 1, 'Prenda sugerida añadida a tu perchero');
    }
  }

  openCheckout(): void {
    this.cart.open();
  }
}
