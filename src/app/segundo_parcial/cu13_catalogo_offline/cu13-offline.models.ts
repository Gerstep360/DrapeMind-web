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
  reservations?: AttendingReservation[];
}
export interface AttendingReservation {
  id: number;
  codigo_publico: string;
  sucursal_id: number;
  estado: string;
  vence_at: string;
  usuario_id: number;
  items: { variante_id: number; cantidad: number; precio_unitario: string }[];
}
export interface OfflineReservationBody {
  operacion_id: string;
  sucursal_id: number;
  snapshot_version: string;
  creado_at: string;
  observacion?: string;
  items: { variante_id: number; cantidad: number; precio_unitario?: string }[];
  efectivo_recibido?: string;
  cliente_id?: number;
  reserva_id?: number;
}
export interface QueuedReservation {
  tipo?: 'RESERVATION' | 'SALE' | 'PICKUP';
  serverId?: number;
  sale?: {
    pedido_id: number;
    codigo_publico: string;
    total: string;
    cambio?: string;
    estado: string;
  };
  key: string;
  owner: string;
  body: OfflineReservationBody;
  name: string;
  branch: string;
  state: 'PENDING' | 'SENDING' | 'UNCERTAIN' | 'CONFLICT' | 'CONFIRMED' | 'CANCELLED' | 'REJECTED';
  attempts: number;
  message?: string;
  reservation?: { id: number; codigo_publico: string; estado: string; vence_at: string };
}
export interface SyncedOperation {
  usuario_nombre?: string;
  sucursal_nombre?: string;
  detalle_prendas?: {
    nombre: string;
    cantidad: number;
    precio_unitario?: string;
    precio_actual?: string;
    variante_id: number;
  }[];
  id: number;
  usuario_id: number;
  operacion_id: string;
  tipo: 'RESERVATION' | 'SALE' | 'PICKUP';
  payload: OfflineReservationBody;
  estado: 'CONFIRMED' | 'CONFLICT' | 'REJECTED';
  intentos: number;
  error?: { message: string };
  resultado?: { sale: QueuedReservation['sale']; reservation: QueuedReservation['reservation'] };
}
