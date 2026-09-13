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

export interface DistinctColor {
  color: string;
  hex: string | null;
  count: number;
}

export type CustomerMode = 'WALK_IN' | 'REGISTERED';
export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'QR';
