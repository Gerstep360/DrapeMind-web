export interface PosTicketItem {
  variantId: number;
  productId: number;
  name: string;
  brand: string;
  color: string;
  colorHex?: string | null;
  size: string;
  sku: string;
  price: number;
  quantity: number;
  maxStock: number;
  image?: string | null;
}

export type AiModelChoice = 'mini' | 'dinamico' | 'altair';

export interface OutfitPiece {
  productId: number;
  variantId?: number;
  name: string;
  brand: string;
  price: number;
  image?: string;
  categoryName?: string;
  role: 'SUPERIOR' | 'INFERIOR' | 'CALZADO' | 'ACCESORIO';
  roleLabel: string;
  color?: string;
  size?: string;
}

export interface OutfitSet {
  id: string;
  title: string;
  occasion: string;
  model: AiModelChoice;
  modelName: string;
  rationale: string;
  totalPrice: number;
  pieces: OutfitPiece[];
}

export interface DistinctColor {
  color: string;
  hex: string | null;
  count: number;
}

export type CustomerMode = 'WALK_IN' | 'REGISTERED';
export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'QR';
