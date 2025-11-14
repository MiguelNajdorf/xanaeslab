import { fetchOfertasPorCiudad, computeEffectivePrice, computeEffectiveUnitPrice, fetchSupermercados } from './store.js';
import { filterOffers, getFilterState } from './filters.js';
import { formatCurrency } from './format.js';

export async function obtenerComparaciones(ciudad, opciones = {}) {
  const ofertas = await fetchOfertasPorCiudad(ciudad);
  const filtradas = filterOffers(ofertas, { ...getFilterState(), ...opciones }, ciudad);
  const vigentes = filtradas.filter(oferta => new Date(oferta.vigencia_hasta) >= new Date());
  const agrupadas = agruparPorProducto(vigentes);
  const supermercados = await fetchSupermercados(ciudad);
  const catalogoSuper = new Map(supermercados.map(s => [s.id, s]));
  const comparaciones = agrupadas.map(({ producto, ofertas }) => {
    const ordenadas = ofertas
      .map(oferta => {
        const efectivo = computeEffectivePrice(oferta, false);
        const unitario = computeEffectiveUnitPrice(oferta, false);
        return {
          oferta,
          precio: efectivo,
          unitario,
          supermercado: catalogoSuper.get(oferta.supermercado_id)
        };
      })
      .sort((a, b) => a.precio - b.precio);

    const mejor = ordenadas[0];
    const mejoresConEmpate = ordenadas.filter(item => Math.abs(item.precio - mejor.precio) < 0.01);
    const resto = ordenadas.slice(mejoresConEmpate.length);

    return {
      producto,
      mejores: mejoresConEmpate,
      resto,
    };
  });

  return comparaciones
    .sort((a, b) => {
      const precioA = a.mejores[0]?.precio ?? Number.POSITIVE_INFINITY;
      const precioB = b.mejores[0]?.precio ?? Number.POSITIVE_INFINITY;
      return precioA - precioB;
    });
}

function agruparPorProducto(ofertas) {
  const grupos = new Map();
  for (const oferta of ofertas) {
    const clave = `${oferta.producto_id}`;
    if (!grupos.has(clave)) {
      grupos.set(clave, { producto: oferta, ofertas: [] });
    }
    grupos.get(clave).ofertas.push(oferta);
  }
  return Array.from(grupos.values());
}

export function describirComparacion({ producto, mejores }) {
  const base = `${producto.producto} ${producto.marca}`.trim();
  const presentacion = producto.presentacion ? ` (${producto.presentacion})` : '';
  const precio = mejores[0]?.precio ?? 0;
  return `${base}${presentacion} - desde ${formatCurrency(precio)}`;
}

export function mapComparacionToCard(model) {
  const producto = model.producto;
  const topPrecio = model.mejores[0];
  const empate = model.mejores.length > 1;
  return {
    id: producto.producto_id || producto.id || producto.producto_id,
    titulo: `${producto.producto} ${producto.marca}`.trim(),
    presentacion: producto.presentacion,
    categoria: producto.categoria,
    mejorPrecio: formatCurrency(topPrecio?.precio ?? 0),
    precioBase: topPrecio?.unitario ? `${formatCurrency(topPrecio.unitario)} por ${producto.unidad_base}` : '',
    badge: producto.promo_tipo && producto.promo_tipo !== 'ninguna' ? producto.promo_tipo : null,
    empate,
  };
}

export function resumenSupermercados(comparacion) {
  const todos = [...comparacion.mejores, ...comparacion.resto];
  return todos.map(item => ({
    nombre: item.supermercado?.nombre || 'Sin nombre',
    precio: formatCurrency(item.precio),
    unitario: item.unitario ? `${formatCurrency(item.unitario)} / ${item.oferta.unidad_base}` : '—',
    promo: item.oferta.promo_tipo,
  }));
}

export function calcularRankingListaDeCompras(items, ofertasPorCiudad) {
  const productosPorId = agruparPorProducto(ofertasPorCiudad);
  const ofertadoPorProducto = new Map();
  for (const grupo of productosPorId) {
    ofertadoPorProducto.set(grupo.producto.producto_id || grupo.producto.id, grupo.ofertas);
  }
  const totalesPorSuper = new Map();
  for (const item of items) {
    const ofertas = ofertadoPorProducto.get(item.producto_id);
    if (!ofertas) continue;
    for (const oferta of ofertas) {
      const prorrateado = computeEffectivePrice(oferta, true) * item.cantidad;
      const total = totalesPorSuper.get(oferta.supermercado_id) || 0;
      totalesPorSuper.set(oferta.supermercado_id, total + prorrateado);
    }
  }
  const ranking = Array.from(totalesPorSuper.entries())
    .map(([superId, total]) => ({ superId, total }))
    .sort((a, b) => a.total - b.total)
    .slice(0, 3)
    .map(item => ({ ...item, totalFormatted: formatCurrency(item.total) }));
  return ranking;
}

export function resumenListaDeComprasOfertas(ofertas) {
  return ofertas.map(oferta => ({
    id: oferta.id,
    descripcion: `${oferta.producto} ${oferta.marca}`.trim(),
    presentacion: oferta.presentacion,
    precio: formatCurrency(oferta.precio_individual),
    promo: oferta.promo_tipo,
    minimo: oferta.min_cantidad_para_promo || null,
  }));
}
