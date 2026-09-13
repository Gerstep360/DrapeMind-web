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
