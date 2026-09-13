import { CommonModule } from '@angular/common';
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
import { AuthService } from '@core/auth.service';
import { BranchService } from '@core/branch.service';
import { CartService } from '@core/cart.service';
import { OnboardingGreeting, UserStyleProfile } from '@core/models';
import { RuntimeConfigService } from '@core/runtime-config.service';
import { ToastService } from '@core/toast.service';
import { OnboardingStage } from './onboarding.models';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingComponent implements OnInit {
  private readonly auth = inject(AuthService);
  readonly branchService = inject(BranchService);
  readonly chosenBranchId = signal<number | null>(null);
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
  readonly selectedGender = signal<string>('');
  readonly selectedStyles = signal<string[]>([]);
  readonly selectedSilhouette = signal<string>('');
  readonly selectedTopSize = signal<string>('');
  readonly selectedBottomSize = signal<string>('');
  readonly selectedShoeSize = signal<string>('');
  readonly selectedColors = signal<string[]>([]);
  readonly selectedBudget = signal<number>(0);
  readonly selectedOccasion = signal<string>('');

  // Custom Sizes
  readonly isCustomTop = signal<boolean>(false);
  readonly customTopSize = signal<string>('');
  readonly isCustomBottom = signal<boolean>(false);
  readonly customBottomSize = signal<string>('');
  readonly isCustomShoe = signal<boolean>(false);
  readonly customShoeSize = signal<string>('');

  readonly effectiveTopSize = computed(() =>
    this.isCustomTop() ? this.customTopSize().trim() || 'M' : this.selectedTopSize(),
  );
  readonly effectiveBottomSize = computed(() =>
    this.isCustomBottom() ? this.customBottomSize().trim() || '30' : this.selectedBottomSize(),
  );
  readonly effectiveShoeSize = computed(() =>
    this.isCustomShoe() ? this.customShoeSize().trim() || '39' : this.selectedShoeSize(),
  );

  // Catalogs
  readonly genderOptions = [
    { id: 'femenino', label: 'Femenino', desc: 'Siluetas y cortes curados para mujer' },
    {
      id: 'masculino',
      label: 'Masculino',
      desc: 'Líneas sartoriales y contemporáneas para hombre',
    },
    {
      id: 'unisex',
      label: 'Andrógino / Unisex',
      desc: 'Prendas versátiles fluidas sin distinción',
    },
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
  readonly shoeSizes = [
    '34',
    '35',
    '36',
    '37',
    '38',
    '39',
    '40',
    '41',
    '42',
    '43',
    '44',
    '45',
    '46',
  ];

  readonly colorOptions = [
    { id: 'Monocromático', desc: 'Negro atelier, blanco crudo y grafito' },
    { id: 'Tonos Tierra', desc: 'Terracota, arena, habano y oliva' },
    { id: 'Neutros Cálidos', desc: 'Beige, marfil y camel' },
    { id: 'Pasteles Nórdicos', desc: 'Celeste hielo, salvia y rosa empolvado' },
    { id: 'Acentos Vivos / Neón', desc: 'Drape Lime, cobalto y magenta' },
  ];

  readonly occasionOptions = [
    {
      id: 'casual',
      label: 'Casual Diario',
      desc: 'Confort con diseño para café, reuniones o paseo',
    },
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
    if (this.branchService.selectedBranchId()) {
      this.chosenBranchId.set(this.branchService.selectedBranchId());
    }

    this.auth.getStyleProfile().subscribe({
      next: (profile) => {
        if (!profile) return;
        if (profile.genero) this.selectedGender.set(profile.genero);
        if (profile.estilos_preferidos?.length) {
          this.selectedStyles.set([...profile.estilos_preferidos]);
        }
        if (profile.silueta_preferida) {
          this.selectedSilhouette.set(profile.silueta_preferida);
        }
        if (profile.talla_superior) {
          this.selectedTopSize.set(profile.talla_superior);
        }
        if (profile.talla_inferior) {
          this.selectedBottomSize.set(profile.talla_inferior);
        }
        if (profile.talla_calzado) {
          this.selectedShoeSize.set(profile.talla_calzado);
        }
        if (profile.colores_favoritos?.length) {
          this.selectedColors.set([...profile.colores_favoritos]);
        }
        if (profile.presupuesto_habitual) {
          this.selectedBudget.set(Number(profile.presupuesto_habitual));
        }
        if (profile.ocasiones_frecuentes?.length) {
          this.selectedOccasion.set(profile.ocasiones_frecuentes[0]);
        }
      },
      error: () => {
        // Nuevo usuario sin perfil de estilo aún
      },
    });
  }

  fetchAltairGreeting(): void {
    this.loadingGreeting.set(true);
    this.auth.getOnboardingGreeting().subscribe({
      next: (res) => {
        this.greetingData.set(res);
        this.displayedGreetingText.set(res.greeting);
        this.loadingGreeting.set(false);
      },
      error: () => {
        this.loadingGreeting.set(false);
        this.toasts.show(
          'Altair no pudo responder. Puedes continuar con tus preferencias.',
          'error',
        );
      },
    });
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
        return list.filter((item) => item !== id);
      }
      return [...list, id];
    });
  }

  toggleColor(id: string): void {
    this.selectedColors.update((list) => {
      if (list.includes(id)) {
        return list.filter((item) => item !== id);
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
    if (!this.chosenBranchId() || this.isSaving()) return;
    this.stage.set('inferring');
    this.isSaving.set(true);
    const payload: Partial<UserStyleProfile> = {
      genero: this.selectedGender() || undefined,
      estilos_preferidos: this.selectedStyles(),
      talla_superior: this.effectiveTopSize() || undefined,
      talla_inferior: this.effectiveBottomSize() || undefined,
      talla_calzado: this.effectiveShoeSize() || undefined,
      colores_favoritos: this.selectedColors(),
      ocasiones_frecuentes: this.selectedOccasion() ? [this.selectedOccasion()] : [],
      presupuesto_habitual: this.selectedBudget() || undefined,
      silueta_preferida: this.selectedSilhouette() || undefined,
    };
    this.auth.saveStyleProfile({ ...payload, infer_outfit: false }).subscribe({
      next: (profile) => {
        this.isSaving.set(false);
        this.auth.markStyleProfileDoneLocally();
        this.resultProfile.set(profile);
        this.stage.set('reveal');
      },
      error: () => {
        this.isSaving.set(false);
        this.stage.set('survey_budget');
        this.toasts.show(
          'No se guardaron tus preferencias. Reintenta sin perder tus respuestas.',
          'error',
        );
      },
    });
  }

  skip(): void {
    // Skipping must not persist unconfirmed default measurements as preferences.
    this.auth.onboardingSkippedForUser.set(this.auth.user()?.id ?? null);
    void this.router.navigate(['/catalog']);
  }

  selectShoppingBranch(id: number): void {
    const branch = this.branchService.branches().find((item) => item.id === id);
    if (!branch) return;
    this.branchService.selectBranch(branch);
    this.chosenBranchId.set(id);
  }

  exploreWithAltair(): void {
    const profile = this.resultProfile();
    if (!profile) return;
    const preferences = {
      estilos: profile.estilos_preferidos,
      tallas: [profile.talla_superior, profile.talla_inferior, profile.talla_calzado],
      colores: profile.colores_favoritos,
      presupuesto: profile.presupuesto_habitual,
      ocasiones: profile.ocasiones_frecuentes,
    };
    const branch = this.branchService.branches().find((item) => item.id === this.chosenBranchId());
    const message = `Quiero explorar novedades disponibles en ${branch?.nombre}. Consulta stock real antes de recomendar. Estas son mis preferencias: ${JSON.stringify(preferences)}`;
    void this.router.navigate(['/ai-studio'], { queryParams: { autoQuery: message } });
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
