import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminApiService } from '@core/api/admin-api.service';
import { Category, ProductAiAssistStudioRequest, ProductAiAssistStudioResponse } from '@core/models';
import { ToastService } from '@core/toast.service';

@Component({
  selector: 'app-ai-product-assist',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ai-product-assist.component.html',
  styleUrl: './ai-product-assist.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiProductAssistComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  readonly drafting = signal(false);
  readonly publishing = signal(false);
  readonly categories = signal<Category[]>([]);
  readonly generatedDraft = signal<ProductAiAssistStudioResponse | null>(null);

  inputForm!: FormGroup;
  resultForm!: FormGroup;

  readonly materialPresets = [
    'Lana de Alpaca 100% y Cachemira',
    'Lino Puro Italiano y Algodón Pima',
    'Seda Natural Mulberry y Raso',
    'Cuero Bovino Encerado Artesanal',
    'Lana Merino Extrafina',
    'Algodón Orgánico Mercerizado',
  ];

  readonly stylePresets = [
    'Alta Costura Minimalista',
    'Sastrería Contemporánea Atelier',
    'Elegancia Nocturna y Gala',
    'Casual Sofisticado Resort',
    'Vanguardia Andina de Autor',
  ];

  ngOnInit(): void {
    this.initForms();
    this.loadCategories();
  }

  private initForms(): void {
    this.inputForm = this.fb.group({
      nombre_borrador: ['', [Validators.required, Validators.minLength(3)]],
      material: ['Lana de Alpaca 100% y Cachemira', [Validators.required]],
      estilo_objetivo: ['Alta Costura Minimalista', [Validators.required]],
      categoria_sugerida: [''],
      genero_objetivo: ['UNISEX', [Validators.required]],
      detalles_confeccion: ['Solapas anchas desestructuradas, forro de seda pura y botones de nácar.'],
      descripcion_imagen: [''],
    });

    this.resultForm = this.fb.group({
      titulo_comercial: ['', [Validators.required]],
      descripcion_editorial: ['', [Validators.required]],
      guia_cuidado: ['', [Validators.required]],
      categoria_id: [null, [Validators.required]],
      precio: [350, [Validators.required, Validators.min(10)]],
      genero_objetivo: ['UNISEX'],
      silueta_corte: [''],
      tags_estilo: [''],
    });
  }

  loadCategories(): void {
    this.adminApi.listCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => {},
    });
  }

  generateDraft(): void {
    if (this.inputForm.invalid) {
      this.inputForm.markAllAsTouched();
      this.toasts.show('Completa el nombre y material del concepto de prenda.', 'info');
      return;
    }

    this.drafting.set(true);
    const val = this.inputForm.value;
    const req: ProductAiAssistStudioRequest = {
      nombre_borrador: val.nombre_borrador.trim(),
      material: val.material,
      estilo_objetivo: val.estilo_objetivo,
      categoria_sugerida: val.categoria_sugerida || null,
      genero_objetivo: val.genero_objetivo,
      detalles_confeccion: val.detalles_confeccion ? val.detalles_confeccion.trim() : null,
      descripcion_imagen: val.descripcion_imagen ? val.descripcion_imagen.trim() : null,
    };

    this.adminApi.assistProductStudio(req).subscribe({
      next: (res) => {
        this.generatedDraft.set(res);
        this.drafting.set(false);

        // Asociar categoría si coincide por nombre
        const matchedCat = this.categories().find(
          (c) => c.nombre.toLowerCase() === res.categoria_recomendada.toLowerCase(),
        ) || this.categories()[0];

        this.resultForm.patchValue({
          titulo_comercial: res.titulo_comercial,
          descripcion_editorial: res.descripcion_editorial,
          guia_cuidado: res.guia_cuidado,
          categoria_id: matchedCat ? matchedCat.id : null,
          precio: Number(res.precio_sugerido_estimado),
          genero_objetivo: val.genero_objetivo,
          silueta_corte: res.silueta_corte,
          tags_estilo: res.tags_estilo.join(', '),
        });

        this.toasts.show('Ficha de alta costura generada exitosamente con Altair AI.', 'success');
      },
      error: (err) => {
        this.drafting.set(false);
        this.toasts.show('Error al generar ficha: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  publishToCatalog(): void {
    if (this.resultForm.invalid) {
      this.resultForm.markAllAsTouched();
      this.toasts.show('Por favor verifica los campos de la ficha técnica.', 'info');
      return;
    }

    this.publishing.set(true);
    const rVal = this.resultForm.value;
    const tagsArray = rVal.tags_estilo
      ? rVal.tags_estilo.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];

    const productPayload = {
      nombre: rVal.titulo_comercial.trim(),
      categoria_id: Number(rVal.categoria_id),
      marca: 'DrapeMind Atelier',
      material: this.inputForm.get('material')?.value || 'Alta Costura',
      precio: Number(rVal.precio),
      calidad_nivel: 5,
      genero_objetivo: rVal.genero_objetivo,
      descripcion: rVal.descripcion_editorial.trim(),
      descripcion_ai: rVal.guia_cuidado.trim(),
      tags_ai: tagsArray,
      activo: true,
      imagenes: ['/static/images/atelier_default.jpg'],
    };

    this.adminApi.createProduct(productPayload).subscribe({
      next: (created) => {
        this.publishing.set(false);
        this.toasts.show(`Prenda "${created.nombre}" registrada y publicada en el catálogo.`, 'success');
        this.router.navigate(['/products-admin']);
      },
      error: (err) => {
        this.publishing.set(false);
        this.toasts.show('Error al registrar en catálogo: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  resetStudio(): void {
    this.generatedDraft.set(null);
    this.inputForm.reset({
      nombre_borrador: '',
      material: 'Lana de Alpaca 100% y Cachemira',
      estilo_objetivo: 'Alta Costura Minimalista',
      categoria_sugerida: '',
      genero_objetivo: 'UNISEX',
      detalles_confeccion: '',
      descripcion_imagen: '',
    });
    this.resultForm.reset();
  }
}
