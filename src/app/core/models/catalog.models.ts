export interface Category {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string | null;
  parent_id: number | null;
  activo: boolean;
}

export interface ProductVariant {
  id: number;
  producto_id: number;
  sku: string;
  color: string;
  codigo_color: string | null;
  talla: string;
  stock_total: number;
  stock_reservado: number;
  stock_disponible: number;
  imagen: string | null;
  activo: boolean;
}

export interface Product {
  id: number;
  categoria_id: number;
  nombre: string;
  descripcion: string | null;
  marca: string | null;
  material: string | null;
  precio: number;
  costo_referencia: number | null;
  calidad_nivel: number;
  genero_objetivo: 'HOMBRE' | 'MUJER' | 'UNISEX' | 'OTRO';
  descripcion_ai: string | null;
  tags_ai: string[] | null;
  imagenes: Array<string | { url?: string; ar_asset?: string }>;
  activo: boolean;
  created_at: string;
  stock_disponible?: number;
  variantes?: ProductVariant[];
}

export interface Branch {
  id: number;
  ciudad_id: number;
  codigo: string;
  nombre: string;
  direccion: string;
  telefono: string | null;
  latitud: number | null;
  longitud: number | null;
  activo: boolean;
  ciudad: string | null;
  departamento: string | null;
}

export interface BranchStock {
  sucursal_id: number;
  variante_id: number;
  producto_id: number;
  producto: string;
  sku: string;
  color: string;
  talla: string;
  stock_total: number;
  stock_reservado: number;
  stock_disponible: number;
  precio?: number;
  activo: boolean;
}

export interface ProductVariantPayload {
  sku: string;
  color: string;
  codigo_color?: string;
  talla: string;
  stock_total: number;
  codigo_barras?: string;
  imagen?: string;
  activo: boolean;
}
