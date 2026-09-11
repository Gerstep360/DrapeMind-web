import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AiActionItem } from '../../../../core/models';
import { RuntimeConfigService } from '../../../../core/runtime-config.service';

@Component({
  selector: 'app-garment-modal',
  standalone: true,
  imports: [DecimalPipe, RouterLink],
  templateUrl: './garment-modal.component.html',
  styleUrl: './garment-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GarmentModalComponent {
  private readonly runtime = inject(RuntimeConfigService);

  @Input() garment: AiActionItem | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() addToCart = new EventEmitter<AiActionItem>();
  @Output() removeFromCart = new EventEmitter<AiActionItem>();

  onClose(): void {
    this.close.emit();
  }

  onAddToCart(): void {
    if (this.garment) {
      this.addToCart.emit(this.garment);
    }
  }

  onRemoveFromCart(): void {
    if (this.garment) {
      this.removeFromCart.emit(this.garment);
    }
  }

  cardImageUrl(item?: AiActionItem): string | null {
    const target = item || this.garment;
    if (!target?.imagen || target.imagen.includes('placeholder')) return null;
    return this.runtime.resolveImageUrl(target.imagen);
  }

  getGarmentType(name?: string): 'top' | 'bottom' | 'shoes' | 'accessory' | 'other' {
    if (!name) return 'other';
    const n = name.toLowerCase();
    if (n.includes('polera') || n.includes('camisa') || n.includes('top') || n.includes('blusa') || n.includes('polo') || n.includes('vestido') || n.includes('hoodie')) {
      return 'top';
    }
    if (n.includes('pantalon') || n.includes('pantalón') || n.includes('jean') || n.includes('jogger') || n.includes('cargo') || n.includes('falda') || n.includes('short')) {
      return 'bottom';
    }
    if (n.includes('calzado') || n.includes('zapato') || n.includes('sneaker') || n.includes('bota') || n.includes('tenis') || n.includes('mocas')) {
      return 'shoes';
    }
    if (n.includes('cinto') || n.includes('gorra') || n.includes('bolso') || n.includes('reloj') || n.includes('joya') || n.includes('lente')) {
      return 'accessory';
    }
    return 'other';
  }

  getGarmentLabel(name?: string): string {
    const t = this.getGarmentType(name);
    switch (t) {
      case 'top': return 'Prenda Superior';
      case 'bottom': return 'Prenda Inferior';
      case 'shoes': return 'Calzado Atelier';
      case 'accessory': return 'Accesorio Curado';
      default: return 'Pieza Showroom';
    }
  }
}
