import { CommonModule, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { BranchService } from '../../core/branch.service';
import { CartService } from '../../core/cart.service';
import { OnboardingGreeting, UserStyleProfile } from '../../core/models';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { ToastService } from '../../core/toast.service';

export type OnboardingStage =
  | 'greeting'
  | 'tutorial'
  | 'survey_gender'
  | 'survey_sizes'
  | 'survey_budget'
  | 'inferring'
  | 'reveal';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly branchService = inject(BranchService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  private readonly runtime = inject(RuntimeConfigService);
  private readonly toasts = inject(ToastService);

  readonly stage = signal<OnboardingStage>('greeting');
  readonly tutorialStep = signal<number>(1);
  readonly greetingData = signal<OnboardingGreeting | null>(null);
  readonly loadingGreeting = signal<boolean>(true);
  readonly displayedGreetingText = signal<string>('');
  readonly isSaving = signal<boolean>(false);
  readonly inferenceStepText = signal<string>('Conectando con el inventario del atelier...');
  readonly resultProfile = signal<UserStyleProfile | null>(null);

  // Survey State
  readonly selectedGender = signal<string>('femenino');
  readonly selectedStyles = signal<string[]>(['Minimalista Atelier', 'Casual Sofisticado']);
  readonly selectedSilhouette = signal<string>('Regular Confort');
  readonly selectedTopSize = signal<string>('M');
  readonly selectedBottomSize = signal<string>('30');
  readonly selectedShoeSize = signal<string>('39');
  readonly selectedColors = signal<string[]>(['Monocromático', 'Tonos Tierra']);
  readonly selectedBudget = signal<number>(600);
  readonly selectedOccasion = signal<string>('casual');

  // Custom Sizes
  readonly isCustomTop = signal<boolean>(false);
  readonly customTopSize = signal<string>('');
  readonly isCustomBottom = signal<boolean>(false);
  readonly customBottomSize = signal<string>('');
  readonly isCustomShoe = signal<boolean>(false);
  readonly customShoeSize = signal<string>('');

  readonly effectiveTopSize = computed(() =>
    this.isCustomTop() ? (this.customTopSize().trim() || 'M') : this.selectedTopSize()
  );
  readonly effectiveBottomSize = computed(() =>
    this.isCustomBottom() ? (this.customBottomSize().trim() || '30') : this.selectedBottomSize()
  );
  readonly effectiveShoeSize = computed(() =>
    this.isCustomShoe() ? (this.customShoeSize().trim() || '39') : this.selectedShoeSize()
  );

  // Catalogs
  readonly genderOptions = [
    { id: 'femenino', label: 'Femenino', desc: 'Siluetas y cortes curados para mujer' },
    { id: 'masculino', label: 'Masculino', desc: 'Líneas sartoriales y contemporáneas para hombre' },
    { id: 'unisex', label: 'Andrógino / Unisex', desc: 'Prendas versátiles fluidas sin distinción' },
    { id: 'otro', label: 'Expresión Libre', desc: 'Exploración híbrida y vanguardista' },
  ];

  readonly styleOptions = [
    { id: 'Minimalista Atelier', desc: 'Líneas limpias, cortes depurados y sobriedad' },
    { id: 'Casual Sofisticado', desc: 'Elegancia sin esfuerzo para el día a día' },
    { id: 'Streetwear Urbano', desc: 'Volúmenes oversize, gráficos sutiles y confort' },
    { id: 'Clásico Contemporáneo', desc: 'Estructuras sartoriales adaptadas a la modernidad' },
    { id: 'Avant-Garde / Editorial', desc: 'Prendas audaces con carácter de pasarela' },
    { id: 'Bohemia Chic', desc: 'Texturas naturales, fluidez y tonalidades botánicas' },
  ];

  readonly silhouetteOptions = ['Oversize', 'Regular Confort', 'Slim Estilizado', 'Fit / Ceñido'];
  readonly topSizes = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
  readonly bottomSizes = ['24', '26', '28', '30', '32', '34', '36', '38', '40', '42', '44', '46'];
  readonly shoeSizes = ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];

  readonly colorOptions = [
    { id: 'Monocromático', desc: 'Negro atelier, blanco crudo y grafito' },
    { id: 'Tonos Tierra', desc: 'Terracota, arena, habano y oliva' },
    { id: 'Neutros Cálidos', desc: 'Beige, marfil y camel' },
    { id: 'Pasteles Nórdicos', desc: 'Celeste hielo, salvia y rosa empolvado' },
    { id: 'Acentos Vivos / Neón', desc: 'Drape Lime, cobalto y magenta' },
  ];

  readonly occasionOptions = [
    { id: 'casual', label: 'Casual Diario', desc: 'Confort con diseño para café, reuniones o paseo' },
    { id: 'trabajo', label: 'Oficina / Sartorial', desc: 'Cortes pulidos y presencia ejecutiva' },
    { id: 'noche', label: 'Salidas & Noche', desc: 'Impacto visual para cócteles o cenas' },
    { id: 'evento', label: 'Eventos Especiales', desc: 'Alta costura y sofisticación formal' },
  ];

  readonly budgetRanges = [
    { value: 300, label: 'Esencial', range: 'Hasta Bs 300' },
    { value: 600, label: 'Intermedio', range: 'Bs 300 - Bs 600' },
    { value: 1000, label: 'Atelier Signature', range: 'Bs 600 - Bs 1,200' },
    { value: 2000, label: 'Colección Exclusiva', range: 'Más de Bs 1,200' },
  ];

  readonly progressPercentage = computed(() => {
    switch (this.stage()) {
      case 'greeting':
        return 15;
      case 'tutorial':
        return 35;
      case 'survey_gender':
        return 55;
      case 'survey_sizes':
        return 75;
      case 'survey_budget':
        return 90;
      case 'inferring':
        return 95;
      case 'reveal':
        return 100;
    }
  });

  ngOnInit(): void {
    this.branchService.loadBranches();
    this.fetchAltairGreeting();
  }

  fetchAltairGreeting(): void {
    this.loadingGreeting.set(true);
    this.auth.getOnboardingGreeting().subscribe({
      next: (res) => {
        const cleanRes: OnboardingGreeting = {
          ...res,
          model: 'Altair Mini',
        };
        this.greetingData.set(cleanRes);
        this.loadingGreeting.set(false);
        this.typeGreeting(cleanRes.greeting);
      },
      error: () => {
        const user = this.auth.user();
        const fallbackName = user?.nombre?.split(' ')[0] || 'amante de la moda';
        const fallback: OnboardingGreeting = {
          greeting: `¡Te doy una cálida bienvenida a DrapeMind, ${fallbackName}! Soy Altair, tu asistente inteligente de moda. Estoy conectado en tiempo real al inventario físico de nuestras boutiques en Bolivia. Acompáñame en este breve recorrido para calibrar tus medidas, preferencias y descubrir tu primer outfit exclusivo.`,
          stylist_name: 'Altair AI',
          model: 'Altair Mini',
          user_name: fallbackName,
          latency_ms: 185,
          tips: [
            'Consultamos stock real en Bolivianos (Bs) antes de recomendarte cualquier prenda.',
            'Tus tallas y gustos quedarán registrados para tus futuras sesiones de asesoría.',
            'Podrás reservar tus looks favoritos directamente en el showroom.',
          ],
        };
        this.greetingData.set(fallback);
        this.loadingGreeting.set(false);
        this.typeGreeting(fallback.greeting);
      },
    });
  }

  private typeGreeting(fullText: string): void {
    let index = 0;
    this.displayedGreetingText.set('');
    const interval = setInterval(() => {
      index += 3;
      if (index >= fullText.length) {
        this.displayedGreetingText.set(fullText);
        clearInterval(interval);
      } else {
        this.displayedGreetingText.set(fullText.slice(0, index));
      }
    }, 18);
  }

  goToTutorial(): void {
    this.stage.set('tutorial');
    this.tutorialStep.set(1);
  }

  nextTutorialStep(): void {
    if (this.tutorialStep() < 3) {
      this.tutorialStep.update((s) => s + 1);
    } else {
      this.stage.set('survey_gender');
    }
  }

  prevTutorialStep(): void {
    if (this.tutorialStep() > 1) {
      this.tutorialStep.update((s) => s - 1);
    } else {
      this.stage.set('greeting');
    }
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

  goToStep(target: OnboardingStage): void {
    this.stage.set(target);
  }

  selectTopSize(size: string): void {
    this.isCustomTop.set(false);
    this.selectedTopSize.set(size);
  }

  enableCustomTop(): void {
    this.isCustomTop.set(true);
  }

  selectBottomSize(size: string): void {
    this.isCustomBottom.set(false);
    this.selectedBottomSize.set(size);
  }

  enableCustomBottom(): void {
    this.isCustomBottom.set(true);
  }

  selectShoeSize(size: string): void {
    this.isCustomShoe.set(false);
    this.selectedShoeSize.set(size);
  }

  enableCustomShoe(): void {
    this.isCustomShoe.set(true);
  }

  startInference(): void {
    this.stage.set('inferring');
    this.isSaving.set(true);

    const steps = [
      'Conectando con el inventario físico de las boutiques...',
      'Filtrando prendas disponibles en talle ' + this.effectiveTopSize() + ' y ' + this.effectiveBottomSize() + '...',
      'Equilibrando paleta ' + this.selectedColors()[0] + ' y presupuesto en Bs...',
      'Altair está seleccionando tu combinación ideal...',
    ];
    let sIdx = 0;
    const interval = setInterval(() => {
      sIdx = (sIdx + 1) % steps.length;
      this.inferenceStepText.set(steps[sIdx]);
    }, 900);

    const payload: Partial<UserStyleProfile> = {
      genero: this.selectedGender(),
      estilos_preferidos: this.selectedStyles(),
      talla_superior: this.effectiveTopSize(),
      talla_inferior: this.effectiveBottomSize(),
      talla_calzado: this.effectiveShoeSize(),
      colores_favoritos: this.selectedColors(),
      ocasiones_frecuentes: [this.selectedOccasion()],
      presupuesto_habitual: this.selectedBudget(),
      silueta_preferida: this.selectedSilhouette(),
      completado: true,
    };

    this.auth.saveStyleProfile({ ...payload, infer_outfit: true }).subscribe({
      next: (profile) => {
        clearInterval(interval);
        this.isSaving.set(false);
        this.auth.markStyleProfileDoneLocally();
        this.resultProfile.set(profile);
        this.stage.set('reveal');
      },
      error: () => {
        clearInterval(interval);
        this.isSaving.set(false);
        this.auth.markStyleProfileDoneLocally();
        this.resultProfile.set({
          ...payload,
          estilos_preferidos: payload.estilos_preferidos || [],
          colores_favoritos: payload.colores_favoritos || [],
          ocasiones_frecuentes: payload.ocasiones_frecuentes || [],
          adn_estilo_ia: `Perfil curado en base a estética ${this.selectedStyles().join(', ')} con silueta ${this.selectedSilhouette()}. Tus tallas y preferencias están registradas para todas tus consultas con Altair.`,
        });
        this.stage.set('reveal');
      },
    });
  }

  skip(): void {
    this.auth.markStyleProfileDoneLocally();
    const payload: Partial<UserStyleProfile> = {
      genero: this.selectedGender(),
      estilos_preferidos: this.selectedStyles(),
      talla_superior: this.effectiveTopSize(),
      talla_inferior: this.effectiveBottomSize(),
      talla_calzado: this.effectiveShoeSize(),
      colores_favoritos: this.selectedColors(),
      ocasiones_frecuentes: [this.selectedOccasion()],
      presupuesto_habitual: this.selectedBudget(),
      silueta_preferida: this.selectedSilhouette(),
      completado: true,
    };
    this.auth.saveStyleProfile({ ...payload, infer_outfit: false }).subscribe({
      next: () => {
        void this.router.navigate(['/catalog']);
      },
      error: () => {
        void this.router.navigate(['/catalog']);
      },
    });
  }

  cardImageUrl(item: any): string | null {
    if (!item?.imagen || item.imagen.includes('placeholder')) return null;
    return this.runtime.resolveImageUrl(item.imagen);
  }

  addAllToCart(): void {
    this.auth.markStyleProfileDoneLocally();
    const outfit = this.resultProfile()?.primer_outfit_ia;
    const items = outfit?.items || [];
    const variants = items
      .filter((it: any) => it.variante_id)
      .map((it: any) => ({ variante_id: it.variante_id, cantidad: 1 }));

    if (variants.length > 0) {
      this.cart.replaceWithItems(variants, `Se agregó tu look de bienvenida al perchero`);
    }
    this.toasts.show('¡Look de bienvenida guardado en tu perchero!', 'success');
    void this.router.navigate(['/catalog']);
  }

  goToAiStudio(): void {
    this.auth.markStyleProfileDoneLocally();
    void this.router.navigate(['/ai-studio']);
  }

  finishAndGoStore(): void {
    this.auth.markStyleProfileDoneLocally();
    void this.router.navigate(['/catalog']);
  }

  colorSlug(id: string): string {
    return id
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-');
  }
}
