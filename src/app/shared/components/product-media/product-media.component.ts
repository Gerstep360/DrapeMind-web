import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { RuntimeConfigService } from '@core/runtime-config.service';

@Component({
  selector: 'app-product-media',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (url(); as image) {
      <img
        [src]="image"
        [alt]="label"
        [style.object-fit]="fit"
        [loading]="loading"
        (error)="failed.set(true)"
      />
    } @else {
      <span
        class="photo-unavailable"
        role="img"
        [attr.aria-label]="label + ': fotografía no disponible'"
        ><span class="photo-unavailable__mark" aria-hidden="true">dm.</span
        ><span class="photo-unavailable__caption" aria-hidden="true">Sin fotografía</span></span
      >
    }`,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        min-height: inherit;
        overflow: hidden;
      }
      img {
        display: block;
        width: 100%;
        height: 100%;
      }
      .photo-unavailable {
        display: flex;
        width: 100%;
        height: 100%;
        min-height: inherit;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 8px;
        background: var(--dm-surface-soft, #f0eee6);
        color: var(--dm-muted, #666);
        container-type: inline-size;
      }
      .photo-unavailable__mark {
        font-family: var(--font-display);
        font-size: clamp(16px, 20cqi, 48px);
        line-height: 1;
        font-weight: 800;
        letter-spacing: -0.08em;
        color: var(--dm-ink, #111);
      }
      .photo-unavailable__caption {
        font-size: clamp(7px, 6cqi, 11px);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        text-align: center;
        padding: 0 4px;
      }
    `,
  ],
})
export class ProductMediaComponent implements OnChanges {
  private readonly runtime = inject(RuntimeConfigService);
  @Input() src: unknown = null;
  @Input() label = 'Prenda';
  @Input() fit: 'cover' | 'contain' = 'cover';
  @Input() loading: 'eager' | 'lazy' = 'lazy';
  readonly failed = signal(false);
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['src']) this.failed.set(false);
  }
  url(): string | null {
    if (this.failed()) return null;
    const resolved = this.runtime.resolveImageUrl(this.src);
    return resolved && !resolved.toLowerCase().includes('placeholder') ? resolved : null;
  }
}
