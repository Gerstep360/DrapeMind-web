export type ReceiptStatusTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

export interface ReceiptStatusMeta {
  label: string;
  tone: ReceiptStatusTone;
}

export const RECEIPT_STATUS_META: Readonly<Record<string, ReceiptStatusMeta>> = {
  PENDIENTE_PAGO: { label: 'Pendiente de pago', tone: 'warning' },
  PAGADO: { label: 'Pago confirmado', tone: 'success' },
  CONFIRMADO: { label: 'Confirmado', tone: 'success' },
  EN_PREPARACION: { label: 'En preparación', tone: 'info' },
  ENVIADO: { label: 'Enviado', tone: 'info' },
  ENTREGADO: { label: 'Entregado', tone: 'success' },
  CANCELADO: { label: 'Cancelado', tone: 'danger' },
  DEVUELTO: { label: 'Devuelto', tone: 'danger' },
};
