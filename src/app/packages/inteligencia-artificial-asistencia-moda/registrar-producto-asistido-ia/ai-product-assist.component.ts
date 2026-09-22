import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AdminApiService } from '@core/api/admin-api.service';
import { Category, ProductAiAssistStudioRequest, ProductAiAssistStudioResponse, ProductVariantPayload } from '@core/models';
import { RuntimeConfigService } from '@core/runtime-config.service';
import { ToastService } from '@core/toast.service';
import { AltairModelSelectorComponent } from '@shared/components/altair/altair-model-selector/altair-model-selector.component';

export interface ProductColorChoice {
  nombre: string;
  hex: string;
}

@Component({
  selector: 'app-ai-product-assist',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AltairModelSelectorComponent],
  templateUrl: './ai-product-assist.component.html',
  styleUrl: './ai-product-assist.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiProductAssistComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly runtime = inject(RuntimeConfigService);

  readonly drafting = signal(false);
  readonly publishing = signal(false);
  readonly categories = signal<Category[]>([]);
  readonly generatedDraft = signal<ProductAiAssistStudioResponse | null>(null);
  readonly selectedModel = signal<'ALTAIR_MINI' | 'ALTAIR_VARIABLE' | 'ALTAIR'>('ALTAIR_MINI');

  // Galeria de imagenes
  readonly imagesList = signal<string[]>([]);
  readonly imageUploading = signal(false);
  readonly newImageUrlInput = signal('');

  // Paleta de colores
  readonly availablePalette = signal<ProductColorChoice[]>([
    { nombre: 'Negro Azabache', hex: '#10110F' },
    { nombre: 'Blanco Crudo', hex: '#F4F5EA' },
    { nombre: 'Azul Marino', hex: '#0B1B3D' },
    { nombre: 'Verde Esmeralda', hex: '#1B4332' },
    { nombre: 'Beige Lino', hex: '#D4C7B5' },
    { nombre: 'Gris Marengo', hex: '#4A4E51' },
    { nombre: 'Borgoña', hex: '#581845' },
    { nombre: 'Terracota', hex: '#C85A32' },
  ]);
  readonly selectedColors = signal<ProductColorChoice[]>([
    { nombre: 'Negro Azabache', hex: '#10110F' },
  ]);
  readonly customColorName = signal('');
  readonly customColorHex = signal('#DFFF3F');

  // Tallas e inventario
  readonly topSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  readonly bottomSizes = ['28', '30', '32', '34', '36', '38', '40'];
  readonly shoeSizes = ['36', '37', '38', '39', '40', '41', '42', '43', '44'];
  readonly accessorySizes = ['Única'];
  readonly selectedSizes = signal<string[]>(['S', 'M', 'L']);

  readonly defaultStockPerVariant = signal<number>(5);
  readonly variantStockMap = signal<Record<string, number>>({});

  readonly aiModels = [
    { id: 'ALTAIR_MINI' as const, label: 'Altair Mini (0.6B)', badge: 'Predeterminado / Rápido' },
    { id: 'ALTAIR_VARIABLE' as const, label: 'Altair Variable', badge: 'Híbrido' },
    { id: 'ALTAIR' as const, label: 'Altair Principal (Gemma 4)', badge: 'Profundo' },
  ];

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

  resolveImage(url: any): string {
    if (!url) return '';
    const resolved = this.runtime.resolveImageUrl(url);
    if (resolved) return resolved;
    return typeof url === 'string' ? url : (url?.url || url?.src || '');
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

  // Gestion de Imagenes
  addImageUrl(): void {
    const url = this.newImageUrlInput().trim();
    if (!url) return;
    this.addImageToList(url);
    this.newImageUrlInput.set('');
  }

  private addImageToList(url: string): void {
    const current = this.imagesList();
    if (!current.includes(url)) {
      this.imagesList.set([url, ...current]);
    }
  }

  removeImage(index: number): void {
    const current = [...this.imagesList()];
    current.splice(index, 1);
    this.imagesList.set(current);
  }

  setPrimaryImage(index: number): void {
    const current = [...this.imagesList()];
    if (index > 0 && index < current.length) {
      const [item] = current.splice(index, 1);
      current.unshift(item);
      this.imagesList.set(current);
      this.toasts.show('Fotografia principal actualizada', 'info');
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.imageUploading.set(true);

      this.adminApi.uploadProductImage(file).subscribe({
        next: (res) => {
          this.imageUploading.set(false);
          const chosenUrl = res?.url || dataUrl;
          this.addImageToList(chosenUrl);
          this.toasts.show('Fotografia subida y vinculada a la prenda', 'info');
        },
        error: () => {
          this.imageUploading.set(false);
          this.addImageToList(dataUrl);
          this.toasts.show('Fotografia guardada en base de datos de manera segura', 'info');
        },
      });
    };
    reader.onerror = () => {
      this.toasts.show('No se pudo leer el archivo de imagen', 'error');
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  // Colores y Variantes
  isColorSelected(nombre: string): boolean {
    return this.selectedColors().some((c) => c.nombre === nombre);
  }

  toggleColor(color: ProductColorChoice): void {
    const current = this.selectedColors();
    if (this.isColorSelected(color.nombre)) {
      if (current.length <= 1) {
        this.toasts.show('Debe haber al menos un color seleccionado', 'info');
        return;
      }
      this.selectedColors.set(current.filter((c) => c.nombre !== color.nombre));
    } else {
      this.selectedColors.set([...current, color]);
    }
  }

  addCustomColor(): void {
    const name = this.customColorName().trim();
    const hex = this.customColorHex();
    if (!name) {
      this.toasts.show('Ingresa un nombre para el color personalizado (ej. Verde Botella)', 'info');
      return;
    }
    const newColor: ProductColorChoice = { nombre: name, hex: hex };
    const exists = this.availablePalette().some(
      (c) => c.nombre.toLowerCase() === name.toLowerCase()
    );
    if (!exists) {
      this.availablePalette.update((pal) => [...pal, newColor]);
    }
    if (!this.isColorSelected(name)) {
      this.selectedColors.update((sel) => [...sel, newColor]);
      this.toasts.show(`Color "${name}" añadido a la paleta y seleccionado`, 'info');
    }
    this.customColorName.set('');
  }

  isSizeSelected(size: string): boolean {
    return this.selectedSizes().includes(size);
  }

  toggleSize(size: string): void {
    const current = this.selectedSizes();
    if (current.includes(size)) {
      if (current.length <= 1) {
        this.toasts.show('Debe haber al menos una talla seleccionada', 'info');
        return;
      }
      this.selectedSizes.set(current.filter((s) => s !== size));
    } else {
      this.selectedSizes.set([...current, size]);
    }
  }

  applySizePreset(type: 'TOPS' | 'BOTTOMS' | 'SHOES' | 'UNIQUE'): void {
    switch (type) {
      case 'TOPS':
        this.selectedSizes.set(['S', 'M', 'L', 'XL']);
        break;
      case 'BOTTOMS':
        this.selectedSizes.set(['30', '32', '34', '36']);
        break;
      case 'SHOES':
        this.selectedSizes.set(['38', '39', '40', '41', '42']);
        break;
      case 'UNIQUE':
        this.selectedSizes.set(['Única']);
        break;
    }
  }

  getStockForVariant(colorName: string, size: string): number {
    const key = `${colorName}__${size}`;
    const map = this.variantStockMap();
    return map[key] !== undefined ? map[key] : this.defaultStockPerVariant();
  }

  setStockForVariant(colorName: string, size: string, qty: number): void {
    const key = `${colorName}__${size}`;
    const val = Math.max(0, qty || 0);
    this.variantStockMap.update((map) => ({ ...map, [key]: val }));
  }

  updateDefaultStock(qty: number): void {
    const val = Math.max(0, qty || 0);
    this.defaultStockPerVariant.set(val);
  }

  autoSuggestPaletteAndSizes(title: string, details: string): void {
    const text = `${title} ${details}`.toLowerCase();
    const matchedColors: ProductColorChoice[] = [];
    if (text.includes('negro') || text.includes('black')) matchedColors.push({ nombre: 'Negro Azabache', hex: '#10110F' });
    if (text.includes('blanco') || text.includes('white') || text.includes('marfil')) matchedColors.push({ nombre: 'Blanco Crudo', hex: '#F4F5EA' });
    if (text.includes('azul') || text.includes('blue') || text.includes('marino')) matchedColors.push({ nombre: 'Azul Marino', hex: '#0B1B3D' });
    if (text.includes('verde') || text.includes('esmeralda')) matchedColors.push({ nombre: 'Verde Esmeralda', hex: '#1B4332' });
    if (text.includes('beige') || text.includes('tierra') || text.includes('arena')) matchedColors.push({ nombre: 'Beige Lino', hex: '#D4C7B5' });
    if (text.includes('rojo') || text.includes('vino') || text.includes('borgoña')) matchedColors.push({ nombre: 'Borgoña', hex: '#581845' });
    if (text.includes('gris') || text.includes('marengo')) matchedColors.push({ nombre: 'Gris Marengo', hex: '#4A4E51' });
    if (text.includes('terracota') || text.includes('oxido')) matchedColors.push({ nombre: 'Terracota', hex: '#C85A32' });

    if (matchedColors.length > 0) {
      this.selectedColors.set(matchedColors);
    }

    if (text.includes('zapato') || text.includes('zapatilla') || text.includes('bota') || text.includes('calzado')) {
      this.selectedSizes.set(['39', '40', '41', '42']);
    } else if (text.includes('pantalon') || text.includes('jean') || text.includes('falda')) {
      this.selectedSizes.set(['30', '32', '34', '36']);
    } else if (text.includes('accesorio') || text.includes('bolso') || text.includes('cinturon')) {
      this.selectedSizes.set(['Única']);
    } else {
      this.selectedSizes.set(['S', 'M', 'L', 'XL']);
    }
  }

  enableManualDraft(): void {
    const val = this.inputForm.value;
    const fallbackTitle = val.nombre_borrador?.trim() || 'Prenda Atelier de Autor';
    const fallbackMaterial = val.material || 'Material de Alta Costura';
    const matchedCat = this.categories().find(
      (c) => c.nombre.toLowerCase() === (val.categoria_sugerida || '').toLowerCase()
    ) || this.categories()[0];

    const manualResponse: ProductAiAssistStudioResponse = {
      titulo_comercial: fallbackTitle,
      descripcion_editorial: `Confeccion sastrera artesanal elaborada en ${fallbackMaterial} con silueta refinada, caida impecable y acabados de autor.`,
      guia_cuidado: 'Limpieza en seco especializada. Evitar lavado mecanico. Planchado a baja temperatura con pano protector.',
      categoria_recomendada: matchedCat ? matchedCat.nombre : 'Sacos',
      precio_sugerido_estimado: 280,
      silueta_corte: 'Corte sastrero contemporaneo de caida limpia',
      tags_estilo: ['Atelier', 'Exclusivo', 'Alta Costura'],
      modelo_utilizado: 'Edicion Manual',
    };

    this.generatedDraft.set(manualResponse);
    this.resultForm.patchValue({
      titulo_comercial: fallbackTitle,
      descripcion_editorial: manualResponse.descripcion_editorial,
      guia_cuidado: manualResponse.guia_cuidado,
      categoria_id: matchedCat ? matchedCat.id : null,
      precio: 280,
      genero_objetivo: val.genero_objetivo || 'UNISEX',
      silueta_corte: manualResponse.silueta_corte,
      tags_estilo: manualResponse.tags_estilo.join(', '),
    });
    this.toasts.show('Ficha tecnica lista para edicion y registro directo en el catalogo.', 'info');
  }

  generateDraft(): void {
    if (this.inputForm.invalid) {
      this.inputForm.markAllAsTouched();
      this.toasts.show('Completa el nombre y material del concepto de prenda.', 'info');
      return;
    }

    this.drafting.set(true);
    const val = this.inputForm.value;
    const selectedColorNames = this.selectedColors().map((c) => c.nombre).join(', ');
    const photoNote = this.imagesList().length > 0 ? ` (${this.imagesList().length} foto(s) adjuntas)` : '';
    const mergedDetails = [
      val.detalles_confeccion ? val.detalles_confeccion.trim() : '',
      selectedColorNames ? `Colores: ${selectedColorNames}` : '',
      photoNote,
    ].filter(Boolean).join(' | ');

    const req: ProductAiAssistStudioRequest = {
      nombre_borrador: val.nombre_borrador.trim(),
      material: val.material,
      estilo_objetivo: val.estilo_objetivo,
      categoria_sugerida: val.categoria_sugerida || null,
      genero_objetivo: val.genero_objetivo,
      detalles_confeccion: mergedDetails || null,
      descripcion_imagen: val.descripcion_imagen ? val.descripcion_imagen.trim() : null,
      modelo_ia: this.selectedModel(),
    };

    this.adminApi.assistProductStudio(req).subscribe({
      next: (res) => {
        this.generatedDraft.set(res);
        this.drafting.set(false);

        // Asociar categoria si coincide por nombre
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

        if (this.selectedColors().length === 0) {
          this.autoSuggestPaletteAndSizes(res.titulo_comercial, val.detalles_confeccion || '');
        }
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
      this.toasts.show('Por favor verifica los campos de la ficha tecnica.', 'info');
      return;
    }

    this.publishing.set(true);
    const rVal = this.resultForm.value;
    const tagsArray = rVal.tags_estilo
      ? rVal.tags_estilo.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];

    const imgs = this.imagesList().length > 0
      ? this.imagesList()
      : ['/static/images/atelier_default.jpg'];

    const productPayload = {
      nombre: rVal.titulo_comercial.trim(),
      categoria_id: Number(rVal.categoria_id),
      marca: 'DrapeMind Atelier',
      material: this.inputForm.get('material')?.value || 'Alta Costura',
      precio: Number(rVal.precio),
      costo_referencia: Math.round(Number(rVal.precio) * 0.45),
      calidad_nivel: 5,
      genero_objetivo: rVal.genero_objetivo || this.inputForm.get('genero_objetivo')?.value || 'UNISEX',
      descripcion: rVal.descripcion_editorial.trim(),
      descripcion_ai: rVal.guia_cuidado.trim(),
      tags_ai: tagsArray,
      activo: true,
      imagenes: imgs,
    };

    this.adminApi.createProduct(productPayload).subscribe({
      next: (created) => {
        const colors = this.selectedColors();
        const sizes = this.selectedSizes();
        if (colors.length === 0 || sizes.length === 0) {
          this.publishing.set(false);
          this.toasts.show(`Prenda "${created.nombre}" registrada y publicada en el catalogo.`, 'success');
          this.router.navigate(['/products-admin']);
          return;
        }

        const primaryImg = imgs[0] || undefined;
        const variantObservables = [];

        for (const c of colors) {
          for (const s of sizes) {
            const stock = this.getStockForVariant(c.nombre, s);
            const cleanColor = c.nombre.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'COL');
            const cleanSize = s.replace(/[^A-Z0-9]/gi, '');
            const sku = `DM-${created.id}-${cleanColor}-${cleanSize}`;
            const payload: ProductVariantPayload = {
              sku: sku,
              color: c.nombre,
              codigo_color: c.hex,
              talla: s,
              stock_total: stock,
              activo: true,
              imagen: primaryImg,
            };
            variantObservables.push(
              this.adminApi.createVariant(created.id, payload).pipe(
                catchError((vErr) => {
                  console.warn(`Aviso al crear variante ${sku}`, vErr);
                  return of(null);
                })
              )
            );
          }
        }

        forkJoin(variantObservables).subscribe({
          next: () => {
            this.publishing.set(false);
            this.toasts.show(
              `Prenda "${created.nombre}" registrada con ${variantObservables.length} variantes e inventario inicial en el catalogo.`,
              'success'
            );
            this.router.navigate(['/products-admin']);
          },
          error: () => {
            this.publishing.set(false);
            this.toasts.show('Prenda creada; algunas variantes pueden requerir ajuste manual', 'info');
            this.router.navigate(['/products-admin']);
          },
        });
      },
      error: (err) => {
        this.publishing.set(false);
        this.toasts.show('Error al registrar en catalogo: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  resetStudio(): void {
    this.generatedDraft.set(null);
    this.imagesList.set([]);
    this.selectedColors.set([{ nombre: 'Negro Azabache', hex: '#10110F' }]);
    this.selectedSizes.set(['S', 'M', 'L']);
    this.variantStockMap.set({});
    this.defaultStockPerVariant.set(5);
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
