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
  producto?: string;
  sku: string;
  color: string;
  codigo_color: string | null;
  talla: string;
  stock_total: number;
  stock_reservado: number;
  stock_disponible: number;
  codigo_barras?: string | null;
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

export interface City {
  id: number;
  nombre: string;
  departamento: string;
  activo: boolean;
}

export interface CityInput {
  nombre: string;
  departamento: string;
  activo?: boolean;
}

export interface BranchInput {
  ciudad_id: number;
  codigo: string;
  nombre: string;
  direccion: string;
  telefono?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  activo?: boolean;
}

export interface CategoryInput {
  nombre: string;
  slug: string;
  descripcion?: string | null;
  parent_id?: number | null;
  activo?: boolean;
}

export interface Supplier {
  id: number;
  nombre_empresa: string;
  nit: string | null;
  contacto_nombre: string | null;
  telefono: string | null;
  email: string | null;
  ciudad: string;
  direccion: string | null;
  categoria_suministro: string;
  activo: boolean;
  usuario_id?: number | null;
  usuario_email?: string | null;
  usuario_nombre?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierAccountInput {
  email: string;
  password: string;
  nombre?: string;
}

export interface SupplierInput {
  nombre_empresa: string;
  nit?: string | null;
  contacto_nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
  ciudad: string;
  direccion?: string | null;
  categoria_suministro: string;
  activo?: boolean;
}

export interface Promotion {
  id: number;
  codigo: string;
  descripcion: string | null;
  tipo_descuento: 'PORCENTAJE' | 'MONTO_FIJO' | 'DOS_POR_UNO' | 'COMPRA_MINIMA' | string;
  valor_descuento: number;
  monto_minimo_compra: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  limite_usos: number | null;
  usos_actuales: number;
  producto_id?: number | null;
  producto_nombre?: string | null;
  producto_imagen?: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromotionInput {
  codigo: string;
  descripcion?: string | null;
  tipo_descuento: 'PORCENTAJE' | 'MONTO_FIJO' | 'DOS_POR_UNO' | 'COMPRA_MINIMA' | string;
  valor_descuento: number;
  monto_minimo_compra?: number;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  limite_usos?: number | null;
  producto_id?: number | null;
  activo?: boolean;
}

export interface Season {
  id: number;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface SeasonInput {
  nombre: string;
  codigo: string;
  descripcion?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  activo?: boolean;
}

export interface SupplierProduct {
  id: number;
  proveedor_id: number;
  nombre_suministro: string;
  sku_proveedor: string | null;
  categoria: string;
  unidad_medida: string;
  costo_unitario: number;
  cantidad_disponible: number;
  tiempo_entrega_dias: number;
  estado: 'DISPONIBLE' | 'BAJO_PEDIDO' | 'AGOTADO';
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierProductInput {
  nombre_suministro: string;
  sku_proveedor?: string | null;
  categoria: string;
  unidad_medida: string;
  costo_unitario: number;
  cantidad_disponible?: number;
  tiempo_entrega_dias?: number;
  estado?: 'DISPONIBLE' | 'BAJO_PEDIDO' | 'AGOTADO';
  activo?: boolean;
}

export interface ProductAiAssistStudioRequest {
  nombre_borrador: string;
  material?: string | null;
  estilo_objetivo?: string | null;
  categoria_sugerida?: string | null;
  genero_objetivo?: string;
  detalles_confeccion?: string | null;
  descripcion_imagen?: string | null;
  modelo_ia?: 'ALTAIR' | 'ALTAIR_MINI' | 'ALTAIR_VARIABLE';
}

export interface ProductAiAssistStudioResponse {
  titulo_comercial: string;
  descripcion_editorial: string;
  guia_cuidado: string;
  tags_estilo: string[];
  silueta_corte: string;
  precio_sugerido_estimado: number;
  categoria_recomendada: string;
  modelo_utilizado?: string;
}

export interface ExecutiveReportRequest {
  tipo_reporte: 'VENTAS_Y_TENDENCIAS' | 'INVENTARIO_Y_STOCK' | 'ASISTENCIA_IA_Y_CLIENTES' | 'ESTRATEGICO_GLOBAL';
  periodo: 'MES_ACTUAL' | 'TRIMESTRE' | 'HISTORICO';
  modelo_ia?: 'ALTAIR' | 'ALTAIR_MINI' | 'ALTAIR_VARIABLE';
  enfoque_especifico?: string | null;
  seed?: number;
}


export interface TablaDinamica {
  titulo: string;
  columnas: string[];
  filas: any[][];
  nota_al_pie?: string | null;
}

export interface SeccionDinamica {
  titulo: string;
  contenido: string;
  tablas?: TablaDinamica[];
}

export interface ReportTable {
  titulo: string;
  columnas: string[];
  filas: any[][];
  resumen?: string | null;
}

export interface ExecutiveReportResponse {
  tipo_reporte?: string;
  periodo?: string;
  modelo_utilizado?: string;
  indicadores_clave: Record<string, any>;
  titulo_reporte?: string;
  tesis_central?: string;
  secciones?: SeccionDinamica[];
  resumen_ejecutivo?: string;
  diagnostico_rendimiento?: string;
  enfoque_personalizado?: string | null;
  tablas_analiticas?: ReportTable[];
  cuellos_de_botella?: string[];
  recomendaciones_estrategicas?: string[];
  fecha_generacion?: string;
}

export type ReporteDinamicoIA = ExecutiveReportResponse;

export interface AiAnalyticsOverview {
  total_sesiones_ia: number;
  total_interacciones: number;
  latencia_promedio_ms: number;
  interacciones_recientes: Array<{
    id: number;
    sesion_id: number;
    tipo: string;
    tool: string | null;
    duracion_ms: number | null;
    estado: string;
    timestamp: string | null;
  }>;
}

export interface SalesHistoryItem {
  pedido_id: number;
  usuario_id: number;
  canal: string;
  tipo_entrega: string;
  estado_pedido: string;
  total: number;
  created_at: string | null;
  completed_at: string | null;
}



