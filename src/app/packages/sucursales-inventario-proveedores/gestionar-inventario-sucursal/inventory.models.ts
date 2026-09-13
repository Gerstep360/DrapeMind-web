import { Product, ProductVariant } from '@core/models';

export interface InventoryRow {
  product: Product;
  variant: ProductVariant;
}
