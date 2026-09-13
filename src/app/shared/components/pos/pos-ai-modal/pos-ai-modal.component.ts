import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AiModelChoice, OutfitPiece, OutfitSet } from '../pos.models';

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

  onClose(): void {
    this.close.emit();
  }

  onSelectModel(model: AiModelChoice): void {
    this.modelChange.emit(model);
  }

  onGenerate(): void {
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
  }

  onAddWholeOutfit(outfit: OutfitSet): void {
    this.addWholeOutfit.emit(outfit);
  }
}
