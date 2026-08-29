export type UserRole = 'CLIENTE' | 'ADMIN' | 'VENDEDOR' | 'ENCARGADO' | 'CAJERO';

export interface User {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  rol: UserRole;
  estado: 'ACTIVO' | 'BLOQUEADO' | 'INACTIVO';
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
}

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

export interface Reservation {
  id: number;
  codigo_publico: string;
  sucursal_id: number | null;
  estado:
    | 'PENDIENTE'
    | 'CONFIRMADA'
    | 'EN_PREPARACION'
    | 'LISTA'
    | 'RETIRADA'
    | 'VENCIDA'
    | 'CANCELADA'
    | 'CONVERTIDA';
  fecha_reserva: string;
  vence_at: string;
  observacion: string | null;
  preparado_por_id?: number | null;
  preparado_at?: string | null;
  atendido_por_id?: number | null;
  atendido_at?: string | null;
  items?: ReservationItem[];
}

export interface ReservationItem {
  variante_id: number;
  cantidad: number;
  precio_referencia: number;
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
  activo: boolean;
}

export interface Order {
  id: number;
  codigo_publico: string;
  sucursal_id?: number | null;
  estado:
    'PENDIENTE_PAGO' | 'PAGADO' | 'PREPARANDO' | 'LISTO' | 'ENVIADO' | 'ENTREGADO' | 'CANCELADO';
  canal: 'MOBILE' | 'WEB' | 'TIENDA';
  tipo_entrega: 'DELIVERY' | 'RECOJO' | 'TIENDA';
  subtotal: number;
  descuento: number;
  costo_envio: number;
  total: number;
  created_at: string;
  paid_at: string | null;
  completed_at: string | null;
}

export interface SalesInventoryMetrics {
  ventas: { pedidos_entregados: number; ingresos: number };
  inventario: { variantes: number; unidades_disponibles: number; stock_bajo: number };
}

export interface AiRuntimeStatus {
  healthy: boolean;
  managed: boolean;
  running: boolean;
  active_requests: number;
  idle_seconds: number | null;
  idle_timeout_seconds: number;
  model: string;
  model_exists: boolean;
  mmproj_exists: boolean;
  executable: string | null;
  platform: 'windows' | 'linux';
}

export interface RealtimeEvent {
  type: string;
  code?: string;
  message?: string;
  order_id?: number;
  reservation_id?: number;
  payment_id?: number;
  status?: string;
}

export interface CartItem {
  id: number;
  variante_id: number;
  producto_id: number;
  nombre: string;
  sku: string;
  color: string;
  talla: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  stock_disponible: number;
  imagen: string | null;
}

export interface Cart {
  id: number;
  estado: string;
  items: CartItem[];
  total_items: number;
  subtotal: number;
}

export interface Address {
  id: number;
  usuario_id: number;
  alias: string;
  departamento: string;
  ciudad: string;
  zona?: string | null;
  direccion: string;
  referencia?: string | null;
  telefono_contacto?: string | null;
  es_principal: boolean;
}

export interface AddressInput {
  alias: string;
  departamento: string;
  ciudad: string;
  zona?: string;
  direccion: string;
  referencia?: string;
  telefono_contacto?: string;
  es_principal?: boolean;
}

export interface CheckoutRequest {
  tipo_entrega: 'DELIVERY' | 'RECOJO' | 'TIENDA';
  direccion_id?: number | null;
  costo_envio?: number;
  observacion?: string | null;
}

export interface Payment {
  id: number;
  pedido_id: number;
  metodo: 'QR' | 'TARJETA' | 'EFECTIVO' | 'TRANSFERENCIA';
  proveedor: string;
  monto: number;
  moneda: string;
  estado: 'PENDIENTE' | 'PROCESANDO' | 'APROBADO' | 'RECHAZADO' | 'REEMBOLSADO';
  referencia_externa: string;
  qr_payload: string | null;
  created_at?: string;
  paid_at?: string | null;
}

export interface PaymentCreate {
  pedido_id: number;
  metodo: 'QR' | 'TARJETA' | 'EFECTIVO' | 'TRANSFERENCIA';
}

export interface AiActionItem {
  id: number;
  variante_id?: number;
  nombre: string;
  precio: number;
  color?: string;
  talla?: string;
  sku?: string;
  imagen?: string | null;
  accion: 'AGREGAR' | 'QUITAR' | 'REEMPLAZAR' | 'VER_PEDIDO' | 'VER_RESERVA';
  item_id?: number;
  motivo?: string;
}

export type AiPresentationMode = 'text' | 'cards' | 'mixed';

export interface AiNotice {
  type: 'info' | 'warning';
  title: string;
  message: string;
}

export interface AiResponseMeta {
  kind?: 'outfit' | 'catalog' | 'orders' | string;
  total_bob?: number;
  budget_bob?: number | null;
  budget_remaining_bob?: number | null;
  item_count?: number;
  occasion?: string;
  can_add_all?: boolean;
}

export interface AiSuggestedAction {
  label: string;
  prompt: string;
}

export interface AgentTraceStep {
  name: string;
  state: 'running' | 'done';
  summary?: string;
  startedAt: number;
  durationMs?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
  error?: boolean;
  tools?: string[];
  actionItems?: AiActionItem[];
  trace?: AgentTraceStep[];
  presentationMode?: AiPresentationMode;
  responseTitle?: string;
  notices?: AiNotice[];
  responseMeta?: AiResponseMeta;
  suggestedActions?: AiSuggestedAction[];
  durationMs?: number;
  createdAt: string | Date;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  backendSessionId?: number | null;
  messages: ChatMessage[];
}

export interface AiSocketEvent {
  type:
    | 'connected'
    | 'thought'
    | 'model_status'
    | 'tool_start'
    | 'tool_result'
    | 'presentation'
    | 'token'
    | 'done'
    | 'error'
    | 'pong';
  status?: 'loading' | 'ready';
  content?: string;
  text?: string;
  message?: string;
  code?: string;
  name?: string;
  result?: unknown;
  session_id?: number;
  interaction_id?: number;
  tools?: string[];
  action_items?: AiActionItem[];
  mode?: AiPresentationMode;
  title?: string;
  card_count?: number;
  presentation_mode?: AiPresentationMode;
  response_title?: string;
  duration_ms?: number;
  notices?: AiNotice[];
  response_meta?: AiResponseMeta;
  suggested_actions?: AiSuggestedAction[];
}
