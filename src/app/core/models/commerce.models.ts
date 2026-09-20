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
  codigo_promocion?: string | null;
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
