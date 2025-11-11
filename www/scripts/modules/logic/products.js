export function extractProductIndex(offers) {
  const map = new Map();
  for (const offer of offers) {
    const key = `${offer.producto}||${offer.marca}||${offer.presentacion}`;
    if (!map.has(key)) {
      map.set(key, {
        producto: offer.producto,
        marca: offer.marca,
        presentacion: offer.presentacion,
        categoria: offer.categoria,
        ciudad: offer.ciudad,
        precioEfectivo: offer.precioEfectivo,
        supermercado: offer.supermercado
      });
    }
    const existing = map.get(key);
    if (offer.precioEfectivo < existing.precioEfectivo) {
      existing.precioEfectivo = offer.precioEfectivo;
      existing.supermercado = offer.supermercado;
    }
  }
  return Array.from(map.values());
}
