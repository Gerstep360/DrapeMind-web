import { CommonModule, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { marked } from 'marked';
import { AiModelChoice, OutfitPiece, OutfitSet } from '../pos.models';

export interface QuickAiSuggestion {
  label: string;
  query: string;
}

@Component({
  selector: 'app-pos-ai-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DecimalPipe],
  templateUrl: './pos-ai-modal.component.html',
  styleUrl: './pos-ai-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosAiModalComponent {
  @Input({ required: true }) open: boolean = false;
  @Input() loading: boolean = false;
  @Input() selectedModel: AiModelChoice = 'altair';
  @Input({ required: true }) occasionControl!: FormControl<string>;
  @Input() outfitSets: OutfitSet[] = [];
  @Input() selectedOutfitSet: OutfitSet | null = null;
  @Input() responseText: string = '';
  @Input() recommendationText: string = '';
  @Input() contextSummary: string = '';

  @Output() close = new EventEmitter<void>();
  @Output() modelChange = new EventEmitter<AiModelChoice>();
  @Output() generate = new EventEmitter<void>();
  @Output() selectOutfitSet = new EventEmitter<OutfitSet | null>();
  @Output() addSinglePiece = new EventEmitter<OutfitPiece>();
  @Output() addWholeOutfit = new EventEmitter<OutfitSet>();

  readonly quickSuggestions: QuickAiSuggestion[] = [
    { label: 'Casual Diario', query: 'casual cómodo para diario' },
    { label: 'Urbano / Streetwear', query: 'streetwear urbano moderno' },
    { label: 'Oficina / Formal', query: 'elegante para oficina' },
    { label: 'Cita / Noche', query: 'outfit para cena o noche' },
    { label: '< Bs 350 Económico', query: 'menos de 350 bs accesible' },
  ];

  // Controles de Personalización Libre para el Vendedor (CU-37)
  readonly selectedGender = signal<'TODOS' | 'MUJER' | 'HOMBRE' | 'UNISEX'>('TODOS');
  readonly selectedTopSize = signal<string>('');
  readonly selectedBottomSize = signal<string>('');
  readonly selectedShoeSize = signal<string>('');
  readonly selectedOccasionQuick = signal<string>('');
  readonly maxBudget = signal<number | null>(null);
  readonly customNotes = signal<string>('');
  readonly showCustomControls = signal<boolean>(true);

  readonly topSizesList = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  readonly bottomSizesList = ['28', '30', '32', '34', '36', '38', '40'];
  readonly shoeSizesList = ['37', '38', '39', '40', '41', '42', '43', '44'];

  /** IDs de prendas añadidas temporalmente para dar feedback visual de confirmación */
  readonly addedPieceIds = signal<Set<number>>(new Set<number>());

  /** IDs de conjuntos añadidos temporalmente para dar feedback visual */
  readonly addedOutfitIds = signal<Set<string>>(new Set<string>());

  setGenderFilter(g: 'TODOS' | 'MUJER' | 'HOMBRE' | 'UNISEX'): void {
    this.selectedGender.set(g);
    this.syncPromptWithFilters();
  }

  setTopSizeFilter(s: string): void {
    this.selectedTopSize.set(this.selectedTopSize() === s ? '' : s);
    this.syncPromptWithFilters();
  }

  setBottomSizeFilter(s: string): void {
    this.selectedBottomSize.set(this.selectedBottomSize() === s ? '' : s);
    this.syncPromptWithFilters();
  }

  setShoeSizeFilter(s: string): void {
    this.selectedShoeSize.set(this.selectedShoeSize() === s ? '' : s);
    this.syncPromptWithFilters();
  }

  setOccasionQuick(occ: string): void {
    this.selectedOccasionQuick.set(this.selectedOccasionQuick() === occ ? '' : occ);
    this.syncPromptWithFilters();
  }

  onBudgetChange(val: number | null): void {
    this.maxBudget.set(val && val > 0 ? val : null);
    this.syncPromptWithFilters();
  }

  onCustomNotesChange(val: string): void {
    this.customNotes.set(val);
    this.syncPromptWithFilters();
  }

  private syncPromptWithFilters(): void {
    const parts: string[] = [];

    if (this.selectedGender() === 'MUJER') parts.push('Para Dama / Femenino');
    else if (this.selectedGender() === 'HOMBRE') parts.push('Para Caballero / Masculino');
    else if (this.selectedGender() === 'UNISEX') parts.push('Estilo Unisex');

    if (this.selectedOccasionQuick()) {
      parts.push(`Ocasión: ${this.selectedOccasionQuick()}`);
    }

    const sizes: string[] = [];
    if (this.selectedTopSize()) sizes.push(`Sup ${this.selectedTopSize()}`);
    if (this.selectedBottomSize()) sizes.push(`Inf ${this.selectedBottomSize()}`);
    if (this.selectedShoeSize()) sizes.push(`Calzado ${this.selectedShoeSize()}`);
    if (sizes.length > 0) parts.push(`Tallas: ${sizes.join(', ')}`);

    if (this.maxBudget()) {
      parts.push(`Presupuesto máx: ${this.maxBudget()} Bs`);
    }

    if (this.customNotes().trim()) {
      parts.push(this.customNotes().trim());
    }

    if (parts.length > 0) {
      this.occasionControl.setValue(parts.join('. '));
    }
  }

  constructor() {
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
  }

  /**
   * Parsea Markdown generado por Altair / Gemma a HTML semántico y seguro.
   */
  renderMarkdown(markdown: string | null | undefined): string {
    if (!markdown) {
      return '';
    }
    return marked.parse(markdown, { async: false }) as string;
  }

  onClose(): void {
    this.close.emit();
  }

  onSelectModel(model: AiModelChoice): void {
    this.modelChange.emit(model);
  }

  onGenerate(): void {
    this.generate.emit();
  }

  onApplySuggestion(query: string): void {
    this.occasionControl.setValue(query);
    this.generate.emit();
  }

  onViewDetail(set: OutfitSet): void {
    this.selectOutfitSet.emit(set);
  }

  onBackToList(): void {
    this.selectOutfitSet.emit(null);
  }

  onAddSinglePiece(piece: OutfitPiece): void {
    this.addSinglePiece.emit(piece);
    this.addedPieceIds.update((set) => {
      const next = new Set(set);
      next.add(piece.productId);
      return next;
    });

    setTimeout(() => {
      this.addedPieceIds.update((set) => {
        const next = new Set(set);
        next.delete(piece.productId);
        return next;
      });
    }, 2000);
  }

  onAddWholeOutfit(outfit: OutfitSet): void {
    this.addWholeOutfit.emit(outfit);
    this.addedOutfitIds.update((set) => {
      const next = new Set(set);
      next.add(outfit.id);
      return next;
    });

    setTimeout(() => {
      this.addedOutfitIds.update((set) => {
        const next = new Set(set);
        next.delete(outfit.id);
        return next;
      });
    }, 2500);
  }

  isPieceAdded(productId: number): boolean {
    return this.addedPieceIds().has(productId);
  }

  isOutfitAdded(outfitId: string): boolean {
    return this.addedOutfitIds().has(outfitId);
  }

  getMatchScore(set: OutfitSet, index: number): number {
    if (set.matchScore) {
      return set.matchScore;
    }
    const defaultScores = [96, 92, 88, 85];
    return defaultScores[index % defaultScores.length];
  }
}
