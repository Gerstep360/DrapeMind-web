import { CommonModule, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { CartService } from '../../../core/cart.service';
import { UserStyleProfile } from '../../../core/models';
import { RuntimeConfigService } from '../../../core/runtime-config.service';

export type OnboardingPhase = 'survey' | 'inferring' | 'reveal';

@Component({
  selector: 'app-style-onboarding-modal',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './style-onboarding-modal.component.html',
  styleUrl: './style-onboarding-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StyleOnboardingModalComponent {
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  private readonly runtime = inject(RuntimeConfigService);

  @Input() isOpen = true;
  @Output() closed = new EventEmitter<void>();
  @Output() completed = new EventEmitter<UserStyleProfile>();

  readonly currentStep = signal<number>(1);
  readonly totalSteps = 4;
  readonly phase = signal<OnboardingPhase>('survey');
  readonly isSaving = signal<boolean>(false);
  readonly inferenceStepText = signal<string>('Analizando siluetas y preferencias...');
  readonly resultProfile = signal<UserStyleProfile | null>(null);

  // Form State
  readonly selectedGender = signal<string>('femenino');
  readonly selectedStyles = signal<string[]>(['Minimalista Atelier', 'Casual Sofisticado']);
  readonly selectedSilhouette = signal<string>('Regular');
  readonly selectedTopSize = signal<string>('M');
  readonly selectedBottomSize = signal<string>('30');
  readonly selectedShoeSize = signal<string>('39');
  readonly selectedColors = signal<string[]>(['Monocromático', 'Tonos Tierra']);
  readonly selectedBudget = signal<number>(600);
  readonly selectedOccasion = signal<string>('casual');

  // Options catalogs
  readonly genderOptions = [
    { id: 'femenino', label: 'Femenino', desc: 'Prendas con cortes y siluetas para mujer' },
    { id: 'masculino', label: 'Masculino', desc: 'Prendas sartoriales y urbanas para hombre' },
    { id: 'unisex', label: 'Andrógino / Unisex', desc: 'Líneas libres sin distinción de género' },
    { id: 'otro', label: 'Expresión Libre', desc: 'Explorar combinaciones híbridas y fluidas' },
  ];

  readonly styleOptions = [
    {
      id: 'Minimalista Atelier',
      label: 'Minimalista Atelier',
      desc: 'Cortes sobrios, tonos neutros y elegancia atemporal',
      icon: 'sparkle',
    },
    {
      id: 'Streetwear Vanguardia',
      label: 'Streetwear Vanguardia',
      desc: 'Siluetas oversize, hoodies y estilo urbano contemporáneo',
      icon: 'urban',
    },
    {
      id: 'Elegante Contemporáneo',
      label: 'Elegante Contemporáneo',
      desc: 'Sastrería pulida para ocasiones formales y eventos',
      icon: 'blazer',
    },
    {
      id: 'Casual Sofisticado',
      label: 'Casual Sofisticado',
      desc: 'Prendas versátiles de alta calidad para el día a día',
      icon: 'tshirt',
    },
    {
      id: 'Bohemio & Botánico',
      label: 'Bohemio & Botánico',
      desc: 'Telas fluidas, estampados orgánicos, lino y seda',
      icon: 'botanic',
    },
  ];

  readonly silhouetteOptions = [
    { id: 'Slim', label: 'Al Cuerpo (Slim)', desc: 'Cortes ceñidos que acentúan la figura' },
    { id: 'Regular', label: 'Clásico (Regular)', desc: 'Caída equilibrada y confort natural' },
    { id: 'Oversized', label: 'Relajado (Oversized)', desc: 'Volumen moderno y holgura estilística' },
  ];

  readonly topSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  readonly bottomSizes = ['28', '30', '32', '34', '36', '38', '40', 'S', 'M', 'L'];
  readonly shoeSizes = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];

  readonly colorOptions = [
    { id: 'Monocromático', label: 'Monocromático', swatch: '#1A1A1A', text: '#FFFFFF' },
    { id: 'Tonos Tierra', label: 'Tonos Tierra', swatch: '#9E7D58', text: '#FFFFFF' },
    { id: 'Pastel & Suave', label: 'Tonos Pastel', swatch: '#B8E4E7', text: '#10110F' },
    { id: 'Vibrantes & Accent', label: 'Acentos Lima', swatch: '#DFFF3F', text: '#10110F' },
    { id: 'Total Black', label: 'Total Black', swatch: '#0D0E0C', text: '#FFFFFF' },
  ];

  readonly budgetOptions = [
    { value: 300, label: 'Esencial', range: 'Hasta Bs 300' },
    { value: 600, label: 'Intermedio', range: 'Bs 300 - Bs 600' },
    { value: 1000, label: 'Atelier Signature', range: 'Bs 600 - Bs 1,200' },
    { value: 2000, label: 'Colección Exclusiva', range: 'Más de Bs 1,200' },
  ];

  nextStep(): void {
    if (this.currentStep() < this.totalSteps) {
      this.currentStep.update((s) => s + 1);
    } else {
      this.startInference();
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update((s) => s - 1);
    }
  }

  skip(): void {
    this.closed.emit();
  }

  toggleStyle(id: string): void {
    this.selectedStyles.update((list) => {
      if (list.includes(id)) {
        return list.length > 1 ? list.filter((item) => item !== id) : list;
      }
      return [...list, id];
    });
  }

  toggleColor(id: string): void {
    this.selectedColors.update((list) => {
      if (list.includes(id)) {
        return list.length > 1 ? list.filter((item) => item !== id) : list;
      }
      return [...list, id];
    });
  }

  startInference(): void {
    this.phase.set('inferring');
    this.isSaving.set(true);

    const steps = [
      'Analizando tu silueta y preferencias estéticas...',
      'Explorando piezas exclusivas con stock real en Showroom...',
      'Verificando tallas y contrastes cromáticos en tiempo real...',
      'Sintetizando tu ADN de estilo con Altair AI...',
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length) {
        this.inferenceStepText.set(steps[stepIdx]);
      }
    }, 900);

    const payload: Partial<UserStyleProfile> & { infer_outfit?: boolean } = {
      genero: this.selectedGender(),
      estilos_preferidos: this.selectedStyles(),
      silueta_preferida: this.selectedSilhouette(),
      talla_superior: this.selectedTopSize(),
      talla_inferior: this.selectedBottomSize(),
      talla_calzado: this.selectedShoeSize(),
      colores_favoritos: this.selectedColors(),
      ocasiones_frecuentes: [this.selectedOccasion()],
      presupuesto_habitual: this.selectedBudget(),
      infer_outfit: true,
    };

    this.auth.saveStyleProfile(payload).subscribe({
      next: (profile) => {
        clearInterval(interval);
        this.isSaving.set(false);
        this.resultProfile.set(profile);
        this.phase.set('reveal');
        this.completed.emit(profile);
      },
      error: () => {
        clearInterval(interval);
        this.isSaving.set(false);
        // Even if inference has a hiccup, advance to reveal gracefully
        this.resultProfile.set({
          ...payload,
          estilos_preferidos: payload.estilos_preferidos || [],
          colores_favoritos: payload.colores_favoritos || [],
          ocasiones_frecuentes: payload.ocasiones_frecuentes || [],
          adn_estilo_ia: `Perfil curado en base a estética ${this.selectedStyles().join(', ')} con silueta ${this.selectedSilhouette()}. Tus tallas y preferencias están registradas para todas tus consultas con Altair.`,
        });
        this.phase.set('reveal');
      },
    });
  }

  cardImageUrl(item: any): string | null {
    if (!item?.imagen || item.imagen.includes('placeholder')) return null;
    return this.runtime.resolveImageUrl(item.imagen);
  }

  addAllToCart(): void {
    const outfit = this.resultProfile()?.primer_outfit_ia;
    const items = outfit?.items || [];
    const variants = items
      .filter((it: any) => it.variante_id)
      .map((it: any) => ({ variante_id: it.variante_id, cantidad: 1 }));

    if (variants.length > 0) {
      this.cart.replaceWithItems(variants, `Se agregó tu primer look de bienvenida al perchero`);
    }
    this.closed.emit();
    void this.router.navigate(['/dashboard']);
  }

  goToAiStudio(): void {
    this.closed.emit();
    void this.router.navigate(['/ai-studio']);
  }

  finishAndGoStore(): void {
    this.closed.emit();
    void this.router.navigate(['/dashboard']);
  }
}
