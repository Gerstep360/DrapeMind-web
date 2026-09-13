export type UserRole = 'CLIENTE' | 'ADMIN' | 'VENDEDOR' | 'ENCARGADO' | 'CAJERO';

export interface User {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  nit_ci?: string | null;
  rol: UserRole;
  estado: 'ACTIVO' | 'BLOQUEADO' | 'INACTIVO';
  created_at: string;
  has_style_profile?: boolean;
}

export interface UserStyleProfile {
  id?: number;
  usuario_id?: number;
  genero?: string | null;
  estilos_preferidos: string[];
  talla_superior?: string | null;
  talla_inferior?: string | null;
  talla_calzado?: string | null;
  colores_favoritos: string[];
  ocasiones_frecuentes: string[];
  presupuesto_habitual?: number | null;
  silueta_preferida?: string | null;
  adn_estilo_ia?: string | null;
  primer_outfit_ia?: any | null;
  completado?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface OnboardingGreeting {
  greeting: string;
  stylist_name: string;
  model: string;
  user_name: string;
  latency_ms: number;
  tips: string[];
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
}
