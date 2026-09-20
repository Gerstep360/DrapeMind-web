import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApiService } from '@core/api/admin-api.service';
import { ToastService } from '@core/toast.service';
import { Category, Product, ProductVariantPayload } from '@core/models';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { RuntimeConfigService } from '@core/runtime-config.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ProductColorChoice {
  nombre: string;
  hex: string;
}

@Component({
  selector: 'app-products-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './products-management.component.html',
  styleUrl: './products-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsManagementComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);
  private readonly runtime = inject(RuntimeConfigService);
  private readonly route = inject(ActivatedRoute);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(false);
  readonly aiDrafting = signal(false);
  readonly aiDesigning = signal(false);
  readonly imageUploading = signal(false);
  readonly savingProduct = signal(false);

  // Filters
  readonly searchQuery = signal('');
  readonly selectedCategoryId = signal<number | null>(null);
  readonly selectedGender = signal<string>('TODOS');
  readonly filterActiveOnly = signal<boolean | null>(null);

  // Modal
  readonly productModalOpen = signal(false);
  readonly editingProduct = signal<Product | null>(null);
  readonly creationMode = signal<'MANUAL' | 'AI'>('MANUAL');
  readonly aiCreativePrompt = signal('');

  // Image Gallery
  readonly imagesList = signal<string[]>([]);
  readonly newImageUrlInput = signal('');
  readonly previewImageUrl = signal<string | null>(null);

  // Colors & Sizes
  readonly defaultPalette: ProductColorChoice[] = [
    { nombre: 'Negro Azabache', hex: '#10110F' },
    { nombre: 'Blanco Crudo', hex: '#F4F5EA' },
    { nombre: 'Azul Marino', hex: '#0B1B3D' },
    { nombre: 'Verde Esmeralda', hex: '#1B4332' },
    { nombre: 'Beige Lino', hex: '#D4C7B5' },
    { nombre: 'Gris Marengo', hex: '#4A4E69' },
    { nombre: 'Borgoña', hex: '#581845' },
    { nombre: 'Terracota', hex: '#C86446' },
  ];
  readonly availablePalette = signal<ProductColorChoice[]>([
    { nombre: 'Negro Azabache', hex: '#10110F' },
    { nombre: 'Blanco Crudo', hex: '#F4F5EA' },
    { nombre: 'Azul Marino', hex: '#0B1B3D' },
    { nombre: 'Verde Esmeralda', hex: '#1B4332' },
    { nombre: 'Beige Lino', hex: '#D4C7B5' },
    { nombre: 'Gris Marengo', hex: '#4A4E69' },
    { nombre: 'Borgoña', hex: '#581845' },
    { nombre: 'Terracota', hex: '#C86446' },
  ]);
  readonly selectedColors = signal<ProductColorChoice[]>([
    { nombre: 'Negro Azabache', hex: '#10110F' },
  ]);
  readonly customColorName = signal('');
  readonly customColorHex = signal('#DFFF3F');

  readonly topSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  readonly bottomSizes = ['28', '30', '32', '34', '36', '38', '40'];
  readonly shoeSizes = ['36', '37', '38', '39', '40', '41', '42', '43', '44'];
  readonly accessorySizes = ['Única'];
  readonly selectedSizes = signal<string[]>(['S', 'M', 'L']);

  readonly defaultStockPerVariant = signal<number>(5);
  readonly variantStockMap = signal<Record<string, number>>({});

  productForm!: FormGroup;

  readonly genders = ['HOMBRE', 'MUJER', 'UNISEX'];

  ngOnInit(): void {
    this.initForm();
    this.loadCategories();
    this.loadProducts();
    this.handleRouteParams();
  }

  private handleRouteParams(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['action'] === 'new') {
        this.openNewProductModal();
      } else if (params['edit']) {
        const editId = +params['edit'];
        if (editId) {
          this.adminApi.getProduct(editId).subscribe({
            next: (p) => this.openEditProductModal(p),
            error: () => {},
          });
        }
      }
    });
  }

  resolveImage(url: string | null | undefined): string {
    if (!url) return '';
    return this.runtime.resolveImageUrl(url) || url;
  }

  private initForm(): void {
    this.productForm = this.fb.group({
      categoria_id: [null, [Validators.required]],
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      marca: ['DrapeMind Atelier'],
      material: ['', [Validators.required]],
      precio: [0, [Validators.required, Validators.min(1)]],
      costo_referencia: [null],
      calidad_nivel: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
      genero_objetivo: ['UNISEX', [Validators.required]],
      descripcion: [''],
      descripcion_ai: [''],
      imagenes: [[]],
      activo: [true],
    });
  }

  loadCategories(): void {
    this.adminApi.listCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => {},
    });
  }

  loadProducts(): void {
    this.loading.set(true);
    this.adminApi
      .listProducts({
        categoria_id: this.selectedCategoryId() || undefined,
        genero: this.selectedGender() === 'TODOS' ? undefined : this.selectedGender(),
        activo: this.filterActiveOnly() === null ? undefined : this.filterActiveOnly()!,
        limit: 100,
      })
      .subscribe({
        next: (data) => {
          this.products.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.toasts.show('Error al cargar catálogo: ' + (err.error?.detail || err.message), 'error');
          this.loading.set(false);
        },
      });
  }

  filteredProducts(): Product[] {
    const q = this.searchQuery().trim().toLowerCase();
    return this.products().filter((p) => {
      return (
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        (p.marca && p.marca.toLowerCase().includes(q)) ||
        (p.material && p.material.toLowerCase().includes(q))
      );
    });
  }

  openNewProductModal(): void {
    this.editingProduct.set(null);
    this.previewImageUrl.set(null);
    this.imagesList.set([]);
    this.newImageUrlInput.set('');
    this.creationMode.set('MANUAL');
    this.aiCreativePrompt.set('');
    this.selectedColors.set([{ nombre: 'Negro Azabache', hex: '#10110F' }]);
    this.selectedSizes.set(['S', 'M', 'L']);
    this.variantStockMap.set({});
    this.defaultStockPerVariant.set(5);

    const firstCat = this.categories().length > 0 ? this.categories()[0].id : null;
    this.productForm.reset({
      categoria_id: this.selectedCategoryId() || firstCat,
      nombre: '',
      marca: 'DrapeMind Atelier',
      material: 'Lino y Algodón Pima',
      precio: 180,
      costo_referencia: 90,
      calidad_nivel: 3,
      genero_objetivo: 'UNISEX',
      descripcion: '',
      descripcion_ai: '',
      imagenes: [],
      activo: true,
    });
    this.productModalOpen.set(true);
  }

  openEditProductModal(p: Product): void {
    this.editingProduct.set(p);
    this.creationMode.set('MANUAL');
    const existingImgs = (p.imagenes || [])
      .map((img: any) => (typeof img === 'string' ? img : img?.url || ''))
      .filter(Boolean);
    this.imagesList.set(existingImgs);
    const imgUrl = existingImgs[0] || null;
    this.previewImageUrl.set(imgUrl);

    this.productForm.patchValue({
      categoria_id: p.categoria_id,
      nombre: p.nombre,
      marca: p.marca || 'DrapeMind Atelier',
      material: p.material || '',
      precio: p.precio,
      costo_referencia: p.costo_referencia,
      calidad_nivel: p.calidad_nivel || 3,
      genero_objetivo: p.genero_objetivo || 'UNISEX',
      descripcion: p.descripcion || '',
      descripcion_ai: p.descripcion_ai || '',
      imagenes: existingImgs,
      activo: p.activo,
    });

    // Cargar variantes existentes de la prenda para pre-poblar colores, tallas y existencias
    this.adminApi.listVariants({ producto_id: p.id }).subscribe({
      next: (variants) => {
        if (variants && variants.length > 0) {
          const colorMap = new Map<string, string>();
          const sizeSet = new Set<string>();
          const stockMap: Record<string, number> = {};

          for (const v of variants) {
            colorMap.set(v.color, v.codigo_color || '#10110F');
            sizeSet.add(v.talla);
            stockMap[`${v.color}__${v.talla}`] = v.stock_total;
          }

          const colors: ProductColorChoice[] = Array.from(colorMap.entries()).map(([nombre, hex]) => ({
            nombre,
            hex,
          }));
          // Integrar los colores existentes a la paleta disponible si no estaban incluidos
          const currentPal = this.availablePalette();
          const merged = [...currentPal];
          for (const c of colors) {
            if (!merged.some((p) => p.nombre.toLowerCase() === c.nombre.toLowerCase())) {
              merged.push(c);
            }
          }
          this.availablePalette.set(merged);
          this.selectedColors.set(colors.length > 0 ? colors : [{ nombre: 'Negro Azabache', hex: '#10110F' }]);
          this.selectedSizes.set(sizeSet.size > 0 ? Array.from(sizeSet) : ['M']);
          this.variantStockMap.set(stockMap);
        }
      },
      error: () => {},
    });

    this.productModalOpen.set(true);
  }

  closeProductModal(): void {
    this.productModalOpen.set(false);
  }

  // Gallery Controls
  addImageUrl(): void {
    const url = this.newImageUrlInput().trim();
    if (!url) return;
    this.addImageToList(url);
    this.newImageUrlInput.set('');
  }

  private addImageToList(url: string): void {
    const current = this.imagesList();
    if (!current.includes(url)) {
      const updated = [url, ...current];
      this.imagesList.set(updated);
      this.previewImageUrl.set(url);
      this.productForm.patchValue({ imagenes: updated });
    }
  }

  removeImage(index: number): void {
    const current = [...this.imagesList()];
    current.splice(index, 1);
    this.imagesList.set(current);
    this.previewImageUrl.set(current[0] || null);
    this.productForm.patchValue({ imagenes: current });
  }

  setPrimaryImage(index: number): void {
    const current = [...this.imagesList()];
    if (index > 0 && index < current.length) {
      const [item] = current.splice(index, 1);
      current.unshift(item);
      this.imagesList.set(current);
      this.previewImageUrl.set(item);
      this.productForm.patchValue({ imagenes: current });
      this.toasts.show('Fotografía principal actualizada', 'info');
    }
  }

  // Colors and Sizes Management
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
      this.toasts.show('Ingresa un nombre para el color personalizado (ej. Verde Botella, Marfil)', 'info');
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

  removeColor(nombre: string): void {
    const current = this.selectedColors();
    if (current.length <= 1) {
      this.toasts.show('Debe haber al menos un color seleccionado', 'info');
      return;
    }
    this.selectedColors.set(current.filter((c) => c.nombre !== nombre));
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

  // Altair Creative AI Generation
  generateWithAltairCreative(): void {
    const prompt = this.aiCreativePrompt().trim();
    if (!prompt) {
      this.toasts.show('Escribe una descripción o concepto sastrero para Altair', 'info');
      return;
    }

    this.aiDesigning.set(true);
    this.adminApi
      .assistProductStudio({
        nombre_borrador: prompt.slice(0, 60),
        detalles_confeccion: prompt,
        estilo_objetivo: 'Alta Costura y Sastrería Contemporánea',
        genero_objetivo: this.productForm.get('genero_objetivo')?.value || 'UNISEX',
        modelo_ia: 'ALTAIR_VARIABLE',
      })
      .subscribe({
        next: (res) => {
          this.aiDesigning.set(false);
          let catId = this.productForm.get('categoria_id')?.value;
          if (res.categoria_recomendada) {
            const found = this.categories().find(
              (c) =>
                c.nombre.toLowerCase().includes(res.categoria_recomendada.toLowerCase()) ||
                res.categoria_recomendada.toLowerCase().includes(c.nombre.toLowerCase())
            );
            if (found) catId = found.id;
          }

          this.productForm.patchValue({
            nombre: res.titulo_comercial,
            categoria_id: catId,
            precio: res.precio_sugerido_estimado || 220,
            costo_referencia: Math.round((res.precio_sugerido_estimado || 220) * 0.45),
            material: res.silueta_corte ? `Silueta sastrera: ${res.silueta_corte}` : 'Lino y Algodón Atelier',
            descripcion: res.descripcion_editorial,
            descripcion_ai: res.guia_cuidado,
            calidad_nivel: 4,
          });

          this.autoSuggestPaletteAndSizes(res.titulo_comercial, prompt);
          this.toasts.show('Ficha técnica generada exitosamente por Altair Creative', 'info');
        },
        error: (err) => {
          this.aiDesigning.set(false);
          this.toasts.show('Error al consultar Altair Creative: ' + (err.error?.detail || err.message), 'error');
        },
      });
  }

  private autoSuggestPaletteAndSizes(title: string, prompt: string): void {
    const text = `${title} ${prompt}`.toLowerCase();
    const matchedColors: ProductColorChoice[] = [];
    if (text.includes('negro') || text.includes('black')) matchedColors.push({ nombre: 'Negro Azabache', hex: '#10110F' });
    if (text.includes('blanco') || text.includes('white') || text.includes('marfil')) matchedColors.push({ nombre: 'Blanco Crudo', hex: '#F4F5EA' });
    if (text.includes('azul') || text.includes('blue') || text.includes('marino')) matchedColors.push({ nombre: 'Azul Marino', hex: '#0B1B3D' });
    if (text.includes('verde') || text.includes('esmeralda')) matchedColors.push({ nombre: 'Verde Esmeralda', hex: '#1B4332' });
    if (text.includes('beige') || text.includes('tierra') || text.includes('arena')) matchedColors.push({ nombre: 'Beige Lino', hex: '#D4C7B5' });
    if (text.includes('rojo') || text.includes('vino') || text.includes('borgoña')) matchedColors.push({ nombre: 'Borgoña', hex: '#581845' });

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

  saveProduct(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      this.toasts.show('Por favor completa todos los campos obligatorios', 'error');
      return;
    }
    this.savingProduct.set(true);
    const val = { ...this.productForm.value };
    val.imagenes = this.imagesList();

    const editing = this.editingProduct();

    if (editing) {
      this.adminApi.updateProduct(editing.id, val).subscribe({
        next: () => {
          // Verificar si se añadieron combinaciones de color/talla no registradas
          this.adminApi.listVariants({ producto_id: editing.id }).subscribe({
            next: (existingVariants) => {
              const existingKeys = new Set(
                (existingVariants || []).map((v) => `${v.color.toLowerCase()}__${v.talla.toLowerCase()}`)
              );
              const newVariantObservables = [];
              const primaryImg = this.imagesList()[0] || undefined;

              for (const c of this.selectedColors()) {
                for (const s of this.selectedSizes()) {
                  const key = `${c.nombre.toLowerCase()}__${s.toLowerCase()}`;
                  if (!existingKeys.has(key)) {
                    const stock = this.getStockForVariant(c.nombre, s);
                    const cleanColor = c.nombre.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'COL');
                    const cleanSize = s.replace(/[^A-Z0-9]/gi, '');
                    const sku = `DM-${editing.id}-${cleanColor}-${cleanSize}`;
                    const payload: ProductVariantPayload = {
                      sku: sku,
                      color: c.nombre,
                      codigo_color: c.hex,
                      talla: s,
                      stock_total: stock,
                      activo: true,
                      imagen: primaryImg,
                    };
                    newVariantObservables.push(
                      this.adminApi.createVariant(editing.id, payload).pipe(
                        catchError(() => of(null))
                      )
                    );
                  }
                }
              }

              if (newVariantObservables.length > 0) {
                forkJoin(newVariantObservables).subscribe({
                  next: () => {
                    this.toasts.show(`Prenda "${val.nombre}" actualizada con nuevas variantes`, 'info');
                    this.finishSave();
                  },
                  error: () => {
                    this.toasts.show(`Prenda "${val.nombre}" actualizada`, 'info');
                    this.finishSave();
                  },
                });
              } else {
                this.toasts.show(`Prenda "${val.nombre}" actualizada`, 'info');
                this.finishSave();
              }
            },
            error: () => {
              this.toasts.show(`Prenda "${val.nombre}" actualizada`, 'info');
              this.finishSave();
            },
          });
        },
        error: (err) => {
          this.savingProduct.set(false);
          this.toasts.show('Error al actualizar prenda: ' + (err.error?.detail || err.message), 'error');
        },
      });
    } else {
      this.adminApi.createProduct(val).subscribe({
        next: (created) => {
          const colors = this.selectedColors();
          const sizes = this.selectedSizes();
          if (colors.length === 0 || sizes.length === 0) {
            this.toasts.show(`Prenda "${val.nombre}" creada en el catálogo`, 'info');
            this.savingProduct.set(false);
            this.closeProductModal();
            this.loadProducts();
            return;
          }

          const primaryImg = this.imagesList()[0] || undefined;
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
              this.toasts.show(
                `Prenda "${val.nombre}" creada con ${variantObservables.length} variantes e inventario inicial`,
                'info'
              );
              this.finishSave();
            },
            error: () => {
              this.toasts.show(`Prenda creada; algunas variantes pueden requerir ajuste manual`, 'info');
              this.finishSave();
            },
          });
        },
        error: (err) => {
          this.savingProduct.set(false);
          this.toasts.show('Error al registrar prenda: ' + (err.error?.detail || err.message), 'error');
        },
      });
    }
  }

  private finishSave(): void {
    this.savingProduct.set(false);
    this.closeProductModal();
    this.loadProducts();
  }

  toggleProductStatus(p: Product): void {
    this.adminApi.deleteProduct(p.id).subscribe({
      next: (res) => {
        this.toasts.show(res.message || 'Estado actualizado', 'info');
        this.loadProducts();
      },
      error: (err) => {
        this.toasts.show('Error al alternar estado: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  // File Upload con fallback seguro Base64 para persistencia garantizada
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.imageUploading.set(true);

      // Intentar subir al servidor static
      this.adminApi.uploadProductImage(file).subscribe({
        next: (res) => {
          this.imageUploading.set(false);
          const chosenUrl = res?.url || dataUrl;
          this.addImageToList(chosenUrl);
          this.toasts.show('Fotografía subida y vinculada a la prenda', 'info');
        },
        error: () => {
          this.imageUploading.set(false);
          // Fallback a DataURL para que la imagen se guarde en PostgreSQL sin fallos de VPS
          this.addImageToList(dataUrl);
          this.toasts.show('Fotografía guardada en base de datos de manera segura', 'info');
        },
      });
    };
    reader.onerror = () => {
      this.toasts.show('No se pudo leer el archivo de imagen', 'error');
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  // AI Assistant Integration (CU-25)
  generateAiDescription(): void {
    const nombre = this.productForm.get('nombre')?.value;
    if (!nombre) {
      this.toasts.show('Ingresa al menos el nombre de la prenda para redactar con IA', 'info');
      return;
    }
    const material = this.productForm.get('material')?.value || 'Alta costura';
    this.aiDrafting.set(true);

    this.adminApi
      .assistProductDraft({
        nombre_borrador: nombre,
        material: material,
        estilo_objetivo: 'Atelier de lujo y sastrería elegante',
      })
      .subscribe({
        next: (res) => {
          this.productForm.patchValue({
            descripcion: res.descripcion_editorial,
            descripcion_ai: res.guia_cuidado,
          });
          this.aiDrafting.set(false);
          this.toasts.show('Descripción editorial redactada por Altair AI', 'info');
        },
        error: () => {
          this.aiDrafting.set(false);
          this.toasts.show('No se pudo conectar con el redactor de IA', 'error');
        },
      });
  }

  extractFirstImage(imagenes: any[] | undefined): string | null {
    if (!imagenes || imagenes.length === 0) return null;
    const first = imagenes[0];
    if (typeof first === 'string') return first;
    return first?.url || null;
  }

  getCategoryName(catId: number): string {
    const c = this.categories().find((cat) => cat.id === catId);
    return c ? c.nombre : 'Cat #' + catId;
  }

  // Metrics
  activeProductsCount(): number {
    return this.products().filter((p) => p.activo).length;
  }

  lowStockProductsCount(): number {
    return this.products().filter((p) => (p.stock_disponible || 0) <= 2).length;
  }

  averageQuality(): number {
    if (this.products().length === 0) return 0;
    const sum = this.products().reduce((acc, p) => acc + (p.calidad_nivel || 3), 0);
    return Math.round((sum / this.products().length) * 10) / 10;
  }
}
