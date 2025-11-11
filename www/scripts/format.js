const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const numberFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const dateFormatter = new Intl.DateTimeFormat('es-AR');

export function formatCurrency(value) {
  return currencyFormatter.format(value ?? 0);
}

export function formatNumber(value) {
  return numberFormatter.format(value ?? 0);
}

export function formatDateISO(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  const [day, month, year] = dateFormatter.formatToParts(d).reduce((acc, part) => {
    if (part.type === 'day') acc[0] = part.value.padStart(2, '0');
    if (part.type === 'month') acc[1] = part.value.padStart(2, '0');
    if (part.type === 'year') acc[2] = part.value;
    return acc;
  }, ['', '', '']);
  return `${day}/${month}/${year}`;
}

export function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value)
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDate(value) {
  if (!value) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [d, m, y] = value.split('/').map(Number);
    const iso = new Date(Date.UTC(y, m - 1, d)).toISOString();
    return iso;
  }
  const iso = new Date(value);
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
}

export function compareDatesAsc(a, b) {
  return new Date(a).getTime() - new Date(b).getTime();
}

export function describePromo({ promo_tipo, promo_param, promo_condicion }) {
  if (!promo_tipo || promo_tipo === 'ninguna') return 'Precio regular';
  switch (promo_tipo) {
    case '2x1':
      return 'Promo 2x1 - llevando 2';
    case '3x2':
      return 'Promo 3x2 - llevando 3';
    case '2da_50':
      return '2da unidad al 50% - llevando 2';
    case 'porcentaje':
      return `Promo ${promo_param}% OFF`;
    case 'precio_banco':
      return `Precio con banco ${promo_condicion || ''}`.trim();
    case 'precio_unidad':
      return 'Precio por unidad con promo';
    case 'suma_fija':
      return promo_param ? `Pack a $${promo_param}` : 'Pack promo';
    default:
      return 'Promo especial';
  }
}

export function promoMinimumQuantity(promo) {
  switch (promo.promo_tipo) {
    case '2x1':
    case '2da_50':
      return 2;
    case '3x2':
    case 'suma_fija':
      return 3;
    default:
      return promo.promo_param && promo.promo_tipo === 'precio_unidad' ? 1 : null;
  }
}

export function formatPresentation(text = '') {
  return text.replace(/\s+/g, ' ').trim();
}
