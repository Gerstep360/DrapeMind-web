import { FormControl } from '@angular/forms';
import { Category } from '@core/models';

export interface CatalogFilterState {
  categories: Category[];
  selectedCategoryId: number | null;
  selectedGender: string;
  maximumPrice: number | null;
  searchControl: FormControl<string>;
  altairOpen: boolean;
  altairContext: string;
}

export type CatalogFilterAction =
  | { type: 'toggle-altair' }
  | { type: 'select-category'; categoryId: number | null }
  | { type: 'select-gender'; gender: string }
  | { type: 'select-maximum-price'; maximumPrice: number | null };
