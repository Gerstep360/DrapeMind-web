import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { AiActionItem } from '../../../../core/models';
import { RuntimeConfigService } from '../../../../core/runtime-config.service';

@Component({
  selector: 'app-garment-card',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './garment-card.component.html',
  styleUrl: './garment-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GarmentCardComponent {
  private readonly runtime = inject(RuntimeConfigService);

  @Input({ required: true }) item!: AiActionItem;
  @Input() index = 0;

  @Output() cardClick = new EventEmitter<AiActionItem>();
  @Output() quickAdd = new EventEmitter<AiActionItem>();

  cardImageUrl(): string | null {
    if (!this.item.imagen || this.item.imagen.includes('placeholder')) return null;
    return this.runtime.resolveImageUrl(this.item.imagen);
  }

  getGarmentType(name: string): 'top' | 'bottom' | 'shoes' | 'accessory' | 'atelier' {
    const n = (name || '').toLowerCase();
    if (
      n.includes('polera') ||
      n.includes('camisa') ||
      n.includes('blusa') ||
      n.includes('polo') ||
      n.includes('top') ||
      n.includes('hoodie') ||
      n.includes('chaleco') ||
      n.includes('casaca') ||
      n.includes('remera')
    ) {
      return 'top';
    }
    if (
      n.includes('pantalon') ||
      n.includes('pantalón') ||
      n.includes('jean') ||
      n.includes('denim') ||
      n.includes('cargo') ||
      n.includes('falda') ||
      n.includes('short') ||
      n.includes('bermuda') ||
      n.includes('palazzo') ||
      n.includes('chino')
    ) {
      return 'bottom';
    }
    if (
      n.includes('zapato') ||
      n.includes('calzado') ||
      n.includes('sneaker') ||
      n.includes('bota') ||
      n.includes('sandalia') ||
      n.includes('mocasin') ||
      n.includes('mocasín') ||
      n.includes('tacon') ||
      n.includes('tacón')
    ) {
      return 'shoes';
    }
    if (
      n.includes('accesorio') ||
      n.includes('cinturon') ||
      n.includes('cinturón') ||
      n.includes('cartera') ||
      n.includes('bolso') ||
      n.includes('gorra') ||
      n.includes('joya') ||
      n.includes('reloj') ||
      n.includes('lentes')
    ) {
      return 'accessory';
    }
    return 'atelier';
  }

  getGarmentLabel(name: string): string {
    const type = this.getGarmentType(name);
    const map = {
      top: 'PRENDA SUPERIOR',
      bottom: 'PRENDA INFERIOR',
      shoes: 'CALZADO ATELIER',
      accessory: 'ACCESORIO DE ESTILO',
      atelier: 'PIEZA ATELIER',
    };
    return map[type];
  }

  onCardClick(): void {
    this.cardClick.emit(this.item);
  }

  onQuickAddClick(event: Event): void {
    event.stopPropagation();
    if (this.item.accion === 'AGREGAR') {
      this.quickAdd.emit(this.item);
    } else {
      this.cardClick.emit(this.item);
    }
  }
}
