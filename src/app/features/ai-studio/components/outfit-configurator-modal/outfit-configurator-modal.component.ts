import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

export interface OutfitConfigResult {
  text: string;
  commandLabel: string;
}

@Component({
  selector: 'app-outfit-configurator-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './outfit-configurator-modal.component.html',
  styleUrl: './outfit-configurator-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutfitConfiguratorModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() submitOutfit = new EventEmitter<OutfitConfigResult>();

  readonly occasions = [
    { id: 'dinamico', label: 'DINÁMICO / CONTEXTO' },
    { id: 'casual', label: 'CASUAL' },
    { id: 'cena', label: 'CENA' },
    { id: 'fiesta', label: 'FIESTA' },
    { id: 'trabajo', label: 'TRABAJO' },
    { id: 'boda', label: 'BODA' },
    { id: 'gala', label: 'GALA' },
  ];

  readonly configForm = new FormGroup({
    occasion: new FormControl('dinamico'),
    topType: new FormControl(''),
    topSize: new FormControl(''),
    bottomType: new FormControl(''),
    bottomSize: new FormControl(''),
    shoeSize: new FormControl(''),
    budget: new FormControl<number | null>(null),
    customDetail: new FormControl(''),
  });

  onClose(): void {
    this.close.emit();
  }

  onSubmit(): void {
    const vals = this.configForm.value;
    const parts: string[] = [];

    if (vals.occasion && vals.occasion !== 'dinamico') {
      parts.push(`Arma un outfit para ocasión ${vals.occasion}`);
    } else {
      parts.push('Diseña un outfit completo según criterio estético y contexto');
    }

    if (vals.topType && vals.topSize) {
      parts.push(`${vals.topType} en talla ${vals.topSize}`);
    } else if (vals.topType) {
      parts.push(`prenda superior tipo ${vals.topType}`);
    } else if (vals.topSize) {
      parts.push(`talla superior ${vals.topSize}`);
    }

    if (vals.bottomType && vals.bottomSize) {
      parts.push(`${vals.bottomType} en talla ${vals.bottomSize}`);
    } else if (vals.bottomType) {
      parts.push(`prenda inferior tipo ${vals.bottomType}`);
    } else if (vals.bottomSize) {
      parts.push(`pantalón talla ${vals.bottomSize}`);
    }

    if (vals.shoeSize) {
      parts.push(`calzado talla ${vals.shoeSize}`);
    }

    if (vals.budget && vals.budget > 0) {
      parts.push(`presupuesto máximo de Bs ${vals.budget}`);
    }

    if (vals.customDetail?.trim()) {
      parts.push(vals.customDetail.trim());
    }

    this.submitOutfit.emit({
      text: parts.join(', '),
      commandLabel: 'Diseñar Outfit a Medida',
    });
    this.close.emit();
  }
}
