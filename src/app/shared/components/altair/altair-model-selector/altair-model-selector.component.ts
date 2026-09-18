import { Component, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface AltairModelOption {
  id: string;
  aliases: string[];
  name: string;
  badge?: string;
  desc: string;
}

@Component({
  selector: 'app-altair-model-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './altair-model-selector.component.html',
  styleUrls: ['./altair-model-selector.component.scss'],
})
export class AltairModelSelectorComponent {
  readonly selectedModel = model<string>('ALTAIR_MINI');
  readonly label = input<string>('Motor de Inteligencia Artificial');
  readonly compact = input<boolean>(false);
  readonly showLabel = input<boolean>(true);

  readonly modelChange = output<string>();

  readonly models: AltairModelOption[] = [
    {
      id: 'ALTAIR_MINI',
      aliases: ['mini', 'ALTAIR_MINI'],
      name: 'Altair Mini',
      badge: 'Rápido',
      desc: 'Inferencia ultra ágil optimizada para respuestas inmediatas (Recomendado)',
    },
    {
      id: 'ALTAIR_VARIABLE',
      aliases: ['dynamic', 'variable', 'ALTAIR_VARIABLE'],
      name: 'Altair Variable',
      badge: 'Balance',
      desc: 'Equilibrio adaptativo entre velocidad y profundidad analítica',
    },
    {
      id: 'ALTAIR',
      aliases: ['gemma', 'altair', 'ALTAIR'],
      name: 'Altair Principal',
      badge: 'Editorial',
      desc: 'Máxima profundidad conceptual, redacción sastrera y síntesis estratégica',
    },
  ];

  isActive(opt: AltairModelOption): boolean {
    const current = (this.selectedModel() || '').toUpperCase();
    return opt.id === current || opt.aliases.map(a => a.toUpperCase()).includes(current);
  }

  select(opt: AltairModelOption): void {
    this.selectedModel.set(opt.id);
    this.modelChange.emit(opt.id);
  }
}
