export interface SalesInventoryMetrics {
  ventas: { pedidos_entregados: number; ingresos: number };
  inventario: { variantes: number; unidades_disponibles: number; stock_bajo: number };
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

export interface InventoryMovement {
  id: number;
  variante_id: number;
  sku?: string;
  producto?: string;
  color?: string;
  talla?: string;
  sucursal_id?: number | null;
  sucursal?: string | null;
  tipo: string;
  cantidad: number;
  stock_total_anterior: number;
  stock_total_nuevo: number;
  usuario_id: number;
  observacion: string;
  created_at: string;
}

export interface ReceiptItem {
  id: number;
  nombre: string;
  sku: string;
  color: string;
  talla: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface ReceiptBranch {
  id: number;
  nombre: string;
  ciudad: string;
  direccion: string;
  telefono: string;
}

export interface ReceiptClient {
  id: number | null;
  nombre: string;
  email: string;
  telefono: string;
}

export interface ReceiptPayment {
  id: number;
  metodo: string;
  monto: number;
  estado: string;
  referencia: string;
  created_at: string | null;
}

export interface ReceiptData {
  order: {
    id: number;
    codigo_publico: string;
    created_at: string | null;
    estado: string;
    canal: string;
    tipo_entrega: string;
    subtotal: number;
    descuento: number;
    costo_envio: number;
    total: number;
    observacion?: string | null;
  };
  sucursal: ReceiptBranch;
  cliente: ReceiptClient;
  items: ReceiptItem[];
  payments: ReceiptPayment[];
}
