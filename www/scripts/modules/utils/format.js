const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2
});

const numberFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});


export function formatCurrency(value, currency = 'ARS') {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2
  }).format(value);
}

export function formatNumber(value) {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  return numberFormatter.format(value);
}

export function formatDate(value) {
  if (!value) {
    return '-';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  const [day, month, year] = [
    String(date.getUTCDate()).padStart(2, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    date.getUTCFullYear()
  ];
  return `${day}/${month}/${year}`;
}

export function parseNumber(input) {
  if (typeof input === 'number') {
    return input;
  }
  if (!input) {
    return null;
  }
  const cleaned = String(input)
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function parseDate(input) {
  if (!input) {
    return null;
  }
  if (input instanceof Date) {
    return input;
  }
  const trimmed = String(input).trim();
  let iso = trimmed;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split('/');
    iso = `${year}-${month}-${day}`;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoDate(input) {
  const date = parseDate(input);
  if (!date) {
    return null;
  }
  const [year, month, day] = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ];
  return `${year}-${month}-${day}`;
}
