import { UserRole } from '../models';

export type NavIcon =
  | 'dashboard'
  | 'catalog'
  | 'inventory'
  | 'reservations'
  | 'orders'
  | 'pos'
  | 'stylist'
  | 'account'
  | 'users'
  | 'branches'
  | 'products'
  | 'categories'
  | 'suppliers'
  | 'promotions'
  | 'seasons'
  | 'ai-assist'
  | 'reports'
  | 'favorites';

export interface PackageNavItem {
  label: string;
  description: string;
  icon: NavIcon;
  route: string;
  roles: UserRole[];
}

export interface PackageNavigation {
  label: string;
  description: string;
  items: PackageNavItem[];
}

const everyone: UserRole[] = ['ADMIN', 'VENDEDOR', 'ENCARGADO', 'CAJERO', 'CLIENTE'];
const staff: UserRole[] = ['ADMIN', 'VENDEDOR', 'ENCARGADO', 'CAJERO'];

export const PACKAGE_NAVIGATION: PackageNavigation[] = [
  {
    label: 'Acceso y gestión de usuarios',
    description: 'Perfil y preferencias',
    items: [
      {
        label: 'Mi cuenta',
        description: 'Datos, direcciones y estilo',
        icon: 'account',
        route: '/account',
        roles: everyone,
      },
      {
        label: 'Usuarios y roles',
        description: 'Gestión de personal y cuentas',
        icon: 'users',
        route: '/users-admin',
        roles: ['ADMIN'],
      },
    ],
  },
  {
    label: 'Catálogo y comercialización',
    description: 'Prendas y disponibilidad',
    items: [
      {
        label: 'Colección',
        description: 'Buscar, filtrar y revisar prendas',
        icon: 'catalog',
        route: '/catalog',
        roles: everyone,
      },
      {
        label: 'Mis Favoritos',
        description: 'Prendas guardadas para compra',
        icon: 'favorites',
        route: '/favorites',
        roles: everyone,
      },
      {
        label: 'Gestión de prendas',
        description: 'Catálogo de prendas, precios y fotos',
        icon: 'products',
        route: '/products-admin',
        roles: ['ADMIN'],
      },
      {
        label: 'Categorías y variantes',
        description: 'Familias, tallas y variantes',
        icon: 'categories',
        route: '/categories-admin',
        roles: ['ADMIN'],
      },
      {
        label: 'Temporadas y colecciones',
        description: 'Campañas, lanzamientos y vigencia',
        icon: 'seasons',
        route: '/seasons-admin',
        roles: ['ADMIN'],
      },
      {
        label: 'Promociones y descuentos',
        description: 'Reglas de descuento y cupones',
        icon: 'promotions',
        route: '/promotions-admin',
        roles: ['ADMIN'],
      },
    ],
  },
  {
    label: 'Carrito, pedidos y pagos',
    description: 'Compra y venta',
    items: [
      {
        label: 'Pedidos y ventas',
        description: 'Historial, entregas y cobros',
        icon: 'orders',
        route: '/orders',
        roles: everyone,
      },
      {
        label: 'Caja',
        description: 'Venta presencial y comprobante',
        icon: 'pos',
        route: '/pos',
        roles: staff,
      },
    ],
  },
  {
    label: 'Reservas y atención en tienda',
    description: 'Preparación y entrega',
    items: [
      {
        label: 'Reservas',
        description: 'QR, preparación y conversión',
        icon: 'reservations',
        route: '/reservations',
        roles: everyone,
      },
    ],
  },
  {
    label: 'Inteligencia artificial y asistencia de moda',
    description: 'Altair y outfits',
    items: [
      {
        label: 'Altair',
        description: 'Asesoría, búsqueda y outfits',
        icon: 'stylist',
        route: '/ai-studio',
        roles: everyone,
      },
      {
        label: 'Estudio de prendas IA',
        description: 'Redacción y categorización asistida',
        icon: 'ai-assist',
        route: '/ai-product-assist',
        roles: ['ADMIN', 'VENDEDOR'],
      },
      {
        label: 'Informes ejecutivos IA',
        description: 'Diagnóstico gerencial y tendencias',
        icon: 'reports',
        route: '/ai-reports',
        roles: ['ADMIN'],
      },
    ],
  },
  {
    label: 'Sucursales, inventario y proveedores',
    description: 'Operación, stock y movimientos',
    items: [
      {
        label: 'Panel general',
        description: 'Resumen operativo del atelier',
        icon: 'dashboard',
        route: '/dashboard',
        roles: everyone,
      },
      {
        label: 'Inventario',
        description: 'Existencias por sucursal',
        icon: 'inventory',
        route: '/inventory',
        roles: ['ADMIN', 'ENCARGADO'],
      },
      {
        label: 'Sedes y ciudades',
        description: 'Locales físicos y cobertura',
        icon: 'branches',
        route: '/branches-admin',
        roles: ['ADMIN'],
      },
      {
        label: 'Proveedores textiles',
        description: 'Agenda de fabricantes e insumos',
        icon: 'suppliers',
        route: '/suppliers-admin',
        roles: ['ADMIN'],
      },
    ],
  },
];


export function navigationForRole(role: UserRole | undefined): PackageNavigation[] {
  if (!role) return [];
  return PACKAGE_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
