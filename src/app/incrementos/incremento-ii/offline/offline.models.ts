export interface OfflineProduct {
  id: number;
  nombre: string;
  descripcion?: string;
  categoria_id: number;
  precio: string;
  imagenes: string[];
}
export interface OfflineVariant {
  id: number;
  producto_id: number;
  sku: string;
  talla: string;
  color: string;
  imagen?: string;
}
export interface OfflineBranch {
  id: number;
  nombre: string;
  direccion: string;
  ciudad: string;
}
export interface OfflineBundle {
  schema_version: number;
  owner: string;
  tenant_id: number;
  user_id: number;
  tenant_name: string;
  version: string;
  downloaded_at: string;
  valid_until: string;
  products: OfflineProduct[];
  variants: OfflineVariant[];
  branches: OfflineBranch[];
  categories: { id: number; nombre: string }[];
  stock: { sucursal_id: number; variante_id: number; disponible: number }[];
}
export interface OfflineReservationBody {
  operacion_id: string;
  sucursal_id: number;
  snapshot_version: string;
  creado_at: string;
  observacion?: string;
  items: { variante_id: number; cantidad: number }[];
}
export interface QueuedReservation {
  key: string;
  owner: string;
  body: OfflineReservationBody;
  name: string;
  branch: string;
  state: 'PENDING' | 'SENDING' | 'UNCERTAIN' | 'CONFLICT' | 'CONFIRMED' | 'CANCELLED';
  attempts: number;
  message?: string;
  reservation?: { id: number; codigo_publico: string; estado: string; vence_at: string };
}
