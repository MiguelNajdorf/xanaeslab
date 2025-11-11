import { parseNumber, toIsoDate } from './format.js';

const UNIT_PATTERNS = [
  { regex: /(\d+(?:[\.,]\d+)?)\s*(kg|kilo|kilogramo?s?)/i, unit: 'g', factor: 1000 },
  { regex: /(\d+(?:[\.,]\d+)?)\s*(g|gramo?s?)/i, unit: 'g', factor: 1 },
  { regex: /(\d+(?:[\.,]\d+)?)\s*(l|litro?s?)/i, unit: 'ml', factor: 1000 },
  { regex: /(\d+(?:[\.,]\d+)?)\s*(ml|centimetro?s?\s*cubico?s?)/i, unit: 'ml', factor: 1 },
  { regex: /pack\s*x\s*(\d+)/i, unit: 'u', factor: 1, countOnly: true },
  { regex: /(\d+)\s*(u|unidades?)/i, unit: 'u', factor: 1 }
];

function extractQuantity(text) {
  if (!text) {
    return null;
  }
  const normalized = text.replace(/-/g, ' ');
  for (const rule of UNIT_PATTERNS) {
    const match = normalized.match(rule.regex);
    if (match) {
      const value = parseNumber(match[rule.countOnly ? 1 : 1]);
      if (!value) continue;
      const baseValue = rule.countOnly ? value : value * rule.factor;
      return { unit: rule.unit, amount: Math.round(baseValue) };
    }
  }
  return null;
}

export function deriveBaseQuantity({ presentacion, sku_presentacion_capturada }) {
  const attempts = [presentacion, sku_presentacion_capturada];
  for (const text of attempts) {
    const quantity = extractQuantity(text);
    if (quantity) {
      return quantity;
    }
  }
  return { unit: 'u', amount: 1 };
}

export function normalizeRow(raw, index) {
  const errors = [];
  const warnings = [];

  const supermercado = raw.supermercado?.trim();
  const ciudad = raw.ciudad?.trim();
  const categoria = raw.categoria?.trim();
  const producto = raw.producto?.trim();
  const marca = raw.marca?.trim();
  const presentacion = raw.presentacion?.trim();
  const sku = raw.sku_presentacion_capturada?.trim();
  const promoTipo = raw.promo_tipo?.trim() || 'ninguna';
  const promoParam = raw.promo_param?.trim() || '';
  const promoCondicion = raw.promo_condicion?.trim() || '';
  const precioIndividual = parseNumber(raw.precio_individual);
  let precioTotal = parseNumber(raw.precio_total);
  const moneda = (raw.moneda?.trim() || 'ARS').toUpperCase();
  const vigenciaDesde = toIsoDate(raw.vigencia_desde);
  const vigenciaHasta = toIsoDate(raw.vigencia_hasta);
  const fuente = raw.fuente?.trim() || '';
  const idExterno = raw.id_externo?.trim() || '';
  const pagina = raw.pagina?.trim() || '';
  const posicion = raw.posicion?.trim() || '';

  if (!supermercado) errors.push('Supermercado requerido');
  if (!ciudad || !['Rio Segundo', 'Pilar'].includes(ciudad)) {
    errors.push('Ciudad inválida');
  }
  if (!precioIndividual || precioIndividual <= 0) {
    errors.push('Precio individual inválido');
  }
  if (precioTotal == null || Number.isNaN(precioTotal)) {
    precioTotal = precioIndividual;
  }
  if (!vigenciaDesde || !vigenciaHasta) {
    errors.push('Fechas de vigencia inválidas');
  } else {
    if (new Date(vigenciaDesde) > new Date(vigenciaHasta)) {
      errors.push('Vigencia desde mayor a hasta');
    }
  }

  const quantity = deriveBaseQuantity({ presentacion, sku_presentacion_capturada: sku });
  const cantidadBase = quantity.amount;
  const unidadBase = quantity.unit;

  if (!cantidadBase || cantidadBase <= 0) {
    errors.push('Cantidad base inválida');
  }

  const baseDivisor = cantidadBase || 1;
  const precioPorBase = precioIndividual / baseDivisor;
  const { precioEfectivo, minCantidad } = calculatePromoPrice({
    tipo: promoTipo,
    precioIndividual,
    precioTotal,
    promoParam,
    promoCondicion
  });

  const precioPorBaseEfectivo = precioEfectivo / baseDivisor;

  return {
    errors,
    warnings,
    row: {
      index,
      supermercado,
      ciudad,
      categoria,
      producto,
      marca,
      presentacion,
      sku,
      skuPresentacionCapturada: sku,
      promoTipo,
      promoParam,
      promoCondicion,
      precioIndividual,
      precioTotal,
      moneda,
      vigenciaDesde,
      vigenciaHasta,
      fuente,
      idExterno,
      pagina,
      posicion,
      cantidadBase,
      unidadBase,
      precioPorBase,
      precioEfectivo,
      precioPorBaseEfectivo,
      minCantidadPromo: minCantidad,
      esBanco: promoTipo === 'precio_banco'
    }
  };
}

export function calculatePromoPrice({ tipo, precioIndividual, precioTotal, promoParam, promoCondicion }) {
  let precioEfectivo = precioIndividual;
  let minCantidad = 1;

  switch (tipo) {
    case '2x1':
      precioEfectivo = precioIndividual / 2;
      minCantidad = 2;
      break;
    case '3x2':
      precioEfectivo = precioIndividual * (2 / 3);
      minCantidad = 3;
      break;
    case '2da_50':
      precioEfectivo = precioIndividual * 0.75;
      minCantidad = 2;
      break;
    case 'porcentaje': {
      const percent = parseNumber(promoParam) ?? 0;
      precioEfectivo = precioIndividual * (1 - percent / 100);
      break;
    }
    case 'precio_banco':
      precioEfectivo = precioIndividual;
      break;
    case 'precio_unidad':
      precioEfectivo = precioIndividual;
      break;
    case 'suma_fija': {
      const amount = parseNumber(promoParam) ?? parseNumber(promoCondicion) ?? precioTotal;
      const group = parseNumber(promoCondicion) ?? 3;
      if (amount && group) {
        precioEfectivo = amount / group;
        minCantidad = group;
      }
      break;
    }
    default:
      precioEfectivo = precioIndividual;
  }

  if (tipo === 'precio_unidad' && precioTotal && precioTotal > 0) {
    precioEfectivo = precioTotal;
  }

  return { precioEfectivo, minCantidad };
}

export function buildDedupKey(row) {
  return [
    row.supermercado,
    row.ciudad,
    row.producto,
    row.marca,
    row.presentacion,
    row.vigenciaDesde,
    row.vigenciaHasta
  ].join('||');
}
