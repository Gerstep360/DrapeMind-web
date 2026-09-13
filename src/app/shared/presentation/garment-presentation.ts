export type GarmentPresentationType = 'top' | 'bottom' | 'shoes' | 'accessory' | 'atelier';

const GARMENT_TERMS: Readonly<
  Record<Exclude<GarmentPresentationType, 'atelier'>, readonly string[]>
> = {
  top: [
    'polera',
    'camisa',
    'blusa',
    'polo',
    'top',
    'hoodie',
    'chaleco',
    'casaca',
    'remera',
    'vestido',
  ],
  bottom: [
    'pantalon',
    'jean',
    'denim',
    'jogger',
    'cargo',
    'falda',
    'short',
    'bermuda',
    'palazzo',
    'chino',
  ],
  shoes: ['zapato', 'calzado', 'sneaker', 'bota', 'sandalia', 'mocasin', 'tacon', 'tenis'],
  accessory: ['accesorio', 'cinturon', 'cartera', 'bolso', 'gorra', 'joya', 'reloj', 'lentes'],
};

const GARMENT_LABELS: Readonly<Record<GarmentPresentationType, string>> = {
  top: 'Prenda superior',
  bottom: 'Prenda inferior',
  shoes: 'Calzado Atelier',
  accessory: 'Accesorio de estilo',
  atelier: 'Pieza Atelier',
};

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function garmentPresentationType(name: string | null | undefined): GarmentPresentationType {
  const normalizedName = normalize(name ?? '');
  for (const [type, terms] of Object.entries(GARMENT_TERMS) as Array<
    [Exclude<GarmentPresentationType, 'atelier'>, readonly string[]]
  >) {
    if (terms.some((term) => normalizedName.includes(term))) return type;
  }
  return 'atelier';
}

export function garmentPresentationLabel(name: string | null | undefined): string {
  return GARMENT_LABELS[garmentPresentationType(name)];
}

export function hasUsableGarmentImage(url: string | null | undefined): url is string {
  return Boolean(url && !url.toLowerCase().includes('placeholder'));
}
