import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NavIcon } from '@core/navigation/package-navigation';

@Component({
  selector: 'app-nav-icon',
  standalone: true,
  template: `
    @switch (name) {
      @case ('catalog') {
        <svg viewBox="0 0 24 24">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />
        </svg>
      }
      @case ('stylist') {
        <svg viewBox="0 0 24 24">
          <path
            d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"
          />
        </svg>
      }
      @case ('orders') {
        <svg viewBox="0 0 24 24">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M8 6h8M8 10h8M8 14h4" />
        </svg>
      }
      @case ('pos') {
        <svg viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18M7 15h.01M11 15h2" />
        </svg>
      }
      @case ('reservations') {
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      }
      @case ('inventory') {
        <svg viewBox="0 0 24 24">
          <path d="m12 2 10 5-10 5L2 7zM2 12l10 5 10-5M2 17l10 5 10-5" />
        </svg>
      }
      @case ('dashboard') {
        <svg viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      }
      @case ('account') {
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      }
    }
  `,
  styles: [
    `
      :host {
        display: grid;
        place-items: center;
        width: 18px;
        height: 18px;
      }
      svg {
        width: 18px;
        height: 18px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavIconComponent {
  @Input({ required: true }) name!: NavIcon;
}
