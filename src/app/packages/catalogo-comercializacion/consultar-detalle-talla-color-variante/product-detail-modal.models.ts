import { BranchStock, Product, ProductVariant } from '@core/models';

export interface ProductColorOption {
  color: string;
  hex: string;
}

export interface ProductSizeOption {
  talla: string;
  stock: number;
}

export interface ProductDetailState {
  open: boolean;
  loading: boolean;
  product: Product | null;
  favorite: boolean;
  colors: ProductColorOption[];
  sizes: ProductSizeOption[];
  selectedColor: string | null;
  selectedSize: string | null;
  selectedQuantity: number;
  activeVariant: ProductVariant | null;
  branchAvailability: BranchStock[];
  branchNames: Readonly<Record<number, string>>;
  selectedBranchId: number | null;
  selectedBranchStock: number;
  selectedBranchName: string;
  reserving: boolean;
}

export type ProductDetailAction =
  | { type: 'close' }
  | { type: 'toggle-favorite'; product: Product }
  | { type: 'ask-altair'; product: Product }
  | { type: 'select-color'; color: string }
  | { type: 'select-size'; size: string }
  | { type: 'select-branch'; branchId: number }
  | { type: 'change-quantity'; delta: number }
  | { type: 'reserve' }
  | { type: 'add-to-cart' }
  | { type: 'buy-now' };
