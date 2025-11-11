export function buildComparatorView({ offers, city, category, includeBanks, search, dateFrom, dateTo, rawPrice, sort }) {
  const filtered = offers.filter((offer) => {
    if (city && offer.ciudad !== city) return false;
    if (category && category !== 'todas' && offer.categoria !== category) return false;
    if (!includeBanks && offer.esBanco) return false;
    if (search) {
      const haystack = `${offer.producto} ${offer.marca} ${offer.presentacion}`.toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    if (dateFrom && offer.vigenciaDesde < dateFrom) return false;
    if (dateTo && offer.vigenciaHasta > dateTo) return false;
    return true;
  });

  const grouped = new Map();
  for (const offer of filtered) {
    const key = `${offer.producto}||${offer.marca}||${offer.presentacion}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(offer);
  }

  const items = [];
  for (const [key, group] of grouped.entries()) {
    const [producto, marca, presentacion] = key.split('||');
    const precios = group.map((offer) => ({
      supermercado: offer.supermercado,
      ciudad: offer.ciudad,
      precio: rawPrice ? offer.precioIndividual : offer.precioEfectivo,
      precioSinPromo: offer.precioIndividual,
      esBanco: offer.esBanco,
      promo: offer.promoTipo,
      promoParam: offer.promoParam,
      promoCondicion: offer.promoCondicion,
      minCantidad: offer.minCantidadPromo,
      vigenciaDesde: offer.vigenciaDesde,
      vigenciaHasta: offer.vigenciaHasta,
      fuente: offer.fuente,
      moneda: offer.moneda,
      precioPorBase: rawPrice ? offer.precioPorBase : offer.precioPorBaseEfectivo,
      unidadBase: offer.unidadBase,
      cantidadBase: offer.cantidadBase,
      historial: offer.historial || []
    }));
    const mejores = precios
      .filter((p) => includeBanks || !p.esBanco)
      .sort((a, b) => a.precio - b.precio);
    const mejor = mejores[0];
    items.push({
      producto,
      marca,
      presentacion,
      precios,
      mejorPrecio: mejor ? mejor.precio : null,
      mejorSupermercado: mejor ? mejor.supermercado : null
    });
  }

  items.sort((a, b) => {
    if (sort === 'vigencia') {
      const aVigencia = getBestVigencia(a.precios);
      const bVigencia = getBestVigencia(b.precios);
      if (aVigencia !== bVigencia) return aVigencia > bVigencia ? -1 : 1;
    }
    if (sort === 'supermercado') {
      const aSuper = a.mejorSupermercado || '';
      const bSuper = b.mejorSupermercado || '';
      if (aSuper !== bSuper) return aSuper.localeCompare(bSuper);
    }
    const aPrecio = a.mejorPrecio ?? Number.POSITIVE_INFINITY;
    const bPrecio = b.mejorPrecio ?? Number.POSITIVE_INFINITY;
    if (aPrecio !== bPrecio) return aPrecio - bPrecio;
    const aSuper = a.mejorSupermercado || '';
    const bSuper = b.mejorSupermercado || '';
    if (aSuper !== bSuper) return aSuper.localeCompare(bSuper);
    return a.producto.localeCompare(b.producto);
  });

  return items;
}

function getBestVigencia(precios) {
  const sorted = [...precios].sort((a, b) => (a.vigenciaHasta > b.vigenciaHasta ? -1 : 1));
  return sorted[0]?.vigenciaHasta ?? '';
}

export function buildHistoricalMap(offers) {
  const history = new Map();
  for (const offer of offers) {
    const key = `${offer.producto}||${offer.marca}||${offer.presentacion}`;
    if (!history.has(key)) {
      history.set(key, []);
    }
    history.get(key).push(offer);
  }
  for (const entries of history.values()) {
    entries.sort((a, b) => (a.vigenciaDesde > b.vigenciaDesde ? -1 : 1));
  }
  return history;
}

export function attachHistory(offers) {
  const history = buildHistoricalMap(offers);
  return offers.map((offer) => {
    const key = `${offer.producto}||${offer.marca}||${offer.presentacion}`;
    return { ...offer, historial: history.get(key) || [] };
  });
}

export function computeCartTotals({ cartItems, offers, includeBanks }) {
  const groupedByProduct = new Map();
  for (const item of cartItems) {
    const key = `${item.producto}||${item.marca}||${item.presentacion}`;
    groupedByProduct.set(key, item.cantidad);
  }

  const bySupermarket = new Map();
  for (const offer of offers) {
    if (!includeBanks && offer.esBanco) continue;
    const key = `${offer.producto}||${offer.marca}||${offer.presentacion}`;
    const quantityNeeded = groupedByProduct.get(key);
    if (!quantityNeeded) continue;
    const effectiveQuantity = Math.max(quantityNeeded, offer.minCantidadPromo || 1);
    const total = offer.precioEfectivo * effectiveQuantity;
    if (!bySupermarket.has(offer.supermercado)) {
      bySupermarket.set(offer.supermercado, { total: 0, detalles: [] });
    }
    const entry = bySupermarket.get(offer.supermercado);
    entry.total += total;
    entry.detalles.push({
      producto: offer.producto,
      marca: offer.marca,
      presentacion: offer.presentacion,
      cantidadSolicitada: quantityNeeded,
      cantidadCalculada: effectiveQuantity,
      precioUnidad: offer.precioEfectivo,
      total,
      promo: offer.promoTipo,
      minCantidad: offer.minCantidadPromo,
      esBanco: offer.esBanco
    });
  }

  const results = [];
  for (const [supermercado, data] of bySupermarket.entries()) {
    results.push({ supermercado, ...data });
  }
  results.sort((a, b) => a.total - b.total);
  return results;
}
