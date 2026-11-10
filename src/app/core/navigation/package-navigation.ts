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

const everyone: UserRole[] = ['ADMIN', 'VENDEDOR', 'ENCARGADO', 'CAJERO', 'CLIENTE', 'PROVEEDOR'];
const staff: UserRole[] = ['ADMIN', 'VENDEDOR', 'ENCARGADO', 'CAJERO'];

export const PACKAGE_NAVIGATION: PackageNavigation[] = [
  {label:'Operación en tienda',description:'Caja, retiros y cambios',items:[
    {label:'Caja y reservas',description:'Cobros de contado y retiros, con o sin señal',icon:'pos',route:'/retail',roles:['ADMIN','ENCARGADO','CAJERO']},
    {label:'Operaciones por revisar',description:'Resolver conflictos y dejar constancia',icon:'inventory',route:'/sync-conflicts',roles:['ADMIN','ENCARGADO']},
    {label:'Cambios y devoluciones',description:'Devolución de prendas y reembolsos',icon:'orders',route:'/exchanges',roles:everyone}
  ]},
  {label:'Reservas guardadas',description:'Solicitudes de esta tienda',items:[{label:'Consultar reservas guardadas',description:'Prendas descargadas y solicitudes pendientes',icon:'reservations',route:'/offline',roles:staff}]},
  {
    label: 'Acceso y gestión de usuarios',
    description: 'Perfil y preferencias',
    items: [
      { label: 'Plan de empresa', description: 'Suscripción y límites', icon: 'branches', route: '/subscription', roles: ['ADMIN'] },
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
        description: 'Cupones, campañas y porcentajes',
        icon: 'promotions',
        route: '/promotions-admin',
        roles: ['ADMIN'],
      },
    ],
  },
  {
    label: 'Carrito, pedidos y pagos',
    description: 'Compras y caja',
    items: [
      {
        label: 'Pedidos y entregas',
        description: 'Historial y despacho de compras',
        icon: 'orders',
        route: '/orders',
        roles: everyone,
      },
      {
        label: 'Cambios y devoluciones',
        description: 'Devolución de prendas y reembolsos',
        icon: 'orders',
        route: '/exchanges',
        roles: everyone,
      },
      {
        label: 'Optimización de perchero',
        description: 'Compatibilidad, ocasión y paleta',
        icon: 'stylist',
        route: '/cart-optimizer',
        roles: everyone,
      },
      {
        label: 'Caja presencial',
        description: 'Contado en caja o tarjeta con Stripe',
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
        label: 'Proveedores y abastecimiento',
        description: 'Ofertas, pedidos y recepción por sucursal',
        icon: 'suppliers',
        route: '/suppliers-admin',
        roles: ['ADMIN', 'PROVEEDOR'],
      },
    ],
  },
];


export const ROUTE_PERMISSIONS: Record<string, string> = {
  '/users-admin': 'team.manage', '/products-admin': 'catalog.manage', '/categories-admin': 'catalog.manage',
  '/collections-admin': 'catalog.manage', '/promotions-admin': 'pricing.manage', '/branches-admin': 'branches.manage',
  '/seasons-admin': 'catalog.manage', '/ai-product-assist': 'catalog.manage',
  '/inventory': 'inventory.manage', '/inventory-admin': 'inventory.manage', '/suppliers-admin': 'suppliers.manage',
  '/retail': 'sales.manage', '/pos': 'sales.manage', '/sync-conflicts': 'sync.review', '/exchanges': 'exchanges.manage',
  '/offline': 'offline.use', '/ai-reports': 'reports.ai', '/business-insights': 'reports.view',
  '/catalog': 'catalog.read', '/dashboard': 'reports.view',
};

export function navigationForRole(role: UserRole | undefined, permissions?: string[]): PackageNavigation[] {
  if (!role) return [];
  return PACKAGE_NAVIGATION.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => {
        if (role === 'CLIENTE') return item.roles.includes('CLIENTE');
        const needed = ROUTE_PERMISSIONS[item.route];
        return role === "ADMIN" || (permissions && needed ? permissions.includes(needed) : item.roles.includes(role));
      })
      .map((item) => {
        if (role === 'PROVEEDOR' && item.route === '/suppliers-admin') {
          return {
            ...item,
            label: 'Mis ofertas y pedidos',
            description: 'Disponibilidad y pedidos de la tienda',
          };
        }
        return item;
      }),
  })).filter((group) => group.items.length > 0);
}
