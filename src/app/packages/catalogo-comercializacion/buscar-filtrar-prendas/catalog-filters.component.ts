import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AltairLauncherComponent } from '@shared/components/altair/altair-launcher/altair-launcher.component';
import { CatalogFilterAction, CatalogFilterState } from './catalog-filters.models';

@Component({
  selector: 'app-catalog-filters',
  standalone: true,
  imports: [ReactiveFormsModule, AltairLauncherComponent],
  templateUrl: './catalog-filters.component.html',
  styleUrl: './catalog-filters.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogFiltersComponent {
  readonly state = input.required<CatalogFilterState>();
  readonly action = output<CatalogFilterAction>();

  readonly categories = computed(() => this.state().categories);
  readonly selectedCategory = computed(() => this.state().selectedCategoryId);
  readonly selectedGender = computed(() => this.state().selectedGender);
  readonly maxPriceFilter = computed(() => this.state().maximumPrice);
  readonly aiPanelOpen = computed(() => this.state().altairOpen);
  readonly altairCatalogContext = computed(() => this.state().altairContext);

  get search() {
    return this.state().searchControl;
  }

  toggleAiPanel(): void {
    this.action.emit({ type: 'toggle-altair' });
  }

  chooseCategory(categoryId: number | null): void {
    this.action.emit({ type: 'select-category', categoryId });
  }

  chooseGender(gender: string): void {
    this.action.emit({ type: 'select-gender', gender });
  }

  chooseMaxPrice(maximumPrice: number | null): void {
    this.action.emit({ type: 'select-maximum-price', maximumPrice });
  }
}
