import {RuntimeConfigService} from '../../core/runtime-config.service';
import {AuthService} from '../../core/auth.service';
import {Router} from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface ReviewItem {
  id: number;
  producto_id: number;
  usuario_id: number;
  calificacion: number;
  titulo?: string | null;
  comentario: string;
  compra_verificada: boolean;
  usuario_nombre: string;
  creado_en: string;
  actualizado_en?: string | null;
}

export interface ReviewsResponse {
  producto_id: number;
  promedio: number;
  total: number;
  distribucion: { [key: string]: number };
  resenas: ReviewItem[];
  mi_resena?: ReviewItem | null;
}

@Component({
  selector: 'app-product-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cu30-product-reviews.component.html',
  styleUrl: './cu30-product-reviews.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductReviewsComponent  {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly Math = Math;
  private generation=0;
  constructor(){ effect(()=>{this.productId();this.auth.user();this.reviewsData.set(null);this.showForm.set(false);this.submitting.set(false);this.reviewTitle='';this.reviewComment='';this.selectedRating.set(5);this.loadReviews();}); }
  ngOnDestroy(){this.generation++;}


  readonly productId = input.required<number>();
  readonly productName = input<string>('Prenda seleccionada');

  readonly loading = signal<boolean>(false);
  readonly loadError = signal('');
  readonly submitting = signal<boolean>(false);
  readonly showForm = signal<boolean>(false);

  readonly reviewsData = signal<ReviewsResponse | null>(null);

  // Form fields
  readonly selectedRating = signal<number>(5);
  reviewTitle = '';
  reviewComment = '';
  readonly formError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly stars = [1, 2, 3, 4, 5];


  loadReviews(): void {
    this.loadError.set('');
    this.loading.set(true);
    const id = this.productId(), generation=++this.generation;
    this.http.get<ReviewsResponse>(`${this.runtime.apiUrl}/products/${id}/reviews`).subscribe({
      next: (res) => {
        if(generation!==this.generation)return;
        this.reviewsData.set(res);
        this.loading.set(false);
        if (res.mi_resena) {
          this.selectedRating.set(res.mi_resena.calificacion);
          this.reviewTitle = res.mi_resena.titulo || '';
          this.reviewComment = res.mi_resena.comentario || '';
        }
      },
      error: () => {
        if(generation!==this.generation)return;
        this.loadError.set('Las opiniones no están disponibles en este momento. Puedes continuar con tu compra.');
        this.loading.set(false);
      },
    });
  }

  setRating(star: number): void {
    this.selectedRating.set(star);
  }

  openReviewForm(): void {
    if(!this.auth.isAuthenticated()){void this.router.navigateByUrl('/login');return;}

    this.formError.set(null);
    this.successMessage.set(null);
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.formError.set(null);
  }

  submitReview(): void {
    if (!this.reviewComment || this.reviewComment.trim().length < 3) {
      this.formError.set('Por favor escribe un comentario de al menos 3 caracteres.');
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);

    const payload = {
      calificacion: this.selectedRating(),
      titulo: this.reviewTitle ? this.reviewTitle.trim() : null,
      comentario: this.reviewComment.trim(),
    };

    const id = this.productId(), generation=this.generation;
    this.http.post<ReviewItem>(`${this.runtime.apiUrl}/products/${id}/reviews`, payload).subscribe({
      next: () => {
        if(generation!==this.generation)return;
        this.submitting.set(false);
        this.showForm.set(false);
        this.successMessage.set('¡Tu reseña ha sido registrada exitosamente!');
        this.loadReviews();
      },
      error: (err) => {
        if(generation!==this.generation)return;
        this.submitting.set(false);
        this.formError.set(
          typeof err.error?.detail==='string'?err.error.detail: 'No se pudo guardar la reseña. Verifica tu sesión.'
        );
      },
    });
  }

  deleteReview(): void {
    if (!confirm('¿Estás seguro de que deseas eliminar tu reseña?')) return;

    const id = this.productId();
    this.http.delete(`${this.runtime.apiUrl}/products/${id}/reviews`).subscribe({
      next: () => {
        this.reviewTitle = '';
        this.reviewComment = '';
        this.selectedRating.set(5);
        this.successMessage.set('Reseña eliminada.');
        this.loadReviews();
      },
      error: (err) => {
        this.formError.set(typeof err.error?.detail==='string'?err.error.detail: 'No se pudo eliminar tu opinión. Inténtalo de nuevo.');
      },
    });
  }

  getStarPercent(stars: number): number {
    const data = this.reviewsData();
    if (!data || data.total === 0) return 0;
    const count = data.distribucion[stars.toString()] || 0;
    return Math.round((count / data.total) * 100);
  }
}

