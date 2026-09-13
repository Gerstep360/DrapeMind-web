import { UserRole } from '../models';

export type NavIcon =
  'dashboard' | 'catalog' | 'inventory' | 'reservations' | 'orders' | 'pos' | 'stylist' | 'account';

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
