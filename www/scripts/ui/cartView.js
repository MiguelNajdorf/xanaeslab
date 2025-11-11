import { listarChanguito, actualizarCantidad, eliminarDelChanguito, vaciarChanguito } from '../cart.js';
import { fetchOfertasPorCiudad, fetchSupermercados, computeEffectivePrice } from '../store.js';
import { formatCurrency } from '../format.js';

export function createCartView({ ciudad }) {
  const container = document.createElement('section');
  container.className = 'section-card cart-view';
  const title = document.createElement('h2');
  title.textContent = 'Tu changuito';
  container.appendChild(title);

  const list = document.createElement('div');
  list.className = 'cart-list';
  container.appendChild(list);

  const summary = document.createElement('div');
  summary.className = 'cart-summary';
  container.appendChild(summary);

  async function render() {
    const items = listarChanguito();
    list.textContent = '';
    if (!items.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Agregá productos desde el comparador para empezar.';
      list.appendChild(empty);
    } else {
      for (const item of items) {
        list.appendChild(renderItem(item));
      }
    }
    await renderSummary(items);
  }

  function renderItem(item) {
    const row = document.createElement('div');
    row.className = 'cart-item';
    const desc = document.createElement('span');
    desc.textContent = item.descripcion || `Producto ${item.producto_id}`;
    const qty = document.createElement('input');
    qty.type = 'number';
    qty.min = '1';
    qty.value = item.cantidad;
    qty.addEventListener('change', () => {
      actualizarCantidad(item.producto_id, Number.parseInt(qty.value, 10) || 1);
      render();
    });
    const remove = document.createElement('button');
    remove.className = 'button-tertiary';
    remove.type = 'button';
    remove.textContent = 'Quitar';
    remove.addEventListener('click', () => {
      eliminarDelChanguito(item.producto_id);
      render();
    });
    row.append(desc, qty, remove);
    return row;
  }

  async function renderSummary(items) {
    summary.textContent = '';
    if (!items.length) return;
    const ofertas = await fetchOfertasPorCiudad(ciudad);
    const supermercados = await fetchSupermercados(ciudad);
    const superMap = new Map(supermercados.map(s => [s.id, s]));

    const totales = new Map();
    const advertencias = new Set();
    for (const item of items) {
      const ofertasProducto = ofertas.filter(oferta => oferta.producto_id === item.producto_id);
      for (const oferta of ofertasProducto) {
        const minimo = oferta.min_cantidad_para_promo || 1;
        const aplicaPromo = item.cantidad >= minimo;
        const precioUnitario = aplicaPromo ? computeEffectivePrice(oferta, true) : oferta.precio_individual;
        if (minimo > 1) {
          const mensaje = aplicaPromo
            ? `${oferta.producto}: llevando ${minimo}`
            : `${oferta.producto}: promo requiere llevar ${minimo}`;
          advertencias.add(mensaje);
        }
        const total = precioUnitario * item.cantidad;
        const actual = totales.get(oferta.supermercado_id) || 0;
        totales.set(oferta.supermercado_id, actual + total);
      }
    }
    const ordenados = Array.from(totales.entries())
      .map(([id, total]) => ({ id, total }))
      .sort((a, b) => a.total - b.total)
      .slice(0, 3);

    const heading = document.createElement('h3');
    heading.textContent = 'Top 3 supermercados';
    summary.appendChild(heading);

    const listRanking = document.createElement('ol');
    for (const entry of ordenados) {
      const li = document.createElement('li');
      const superInfo = superMap.get(entry.id);
      li.textContent = `${superInfo?.nombre || 'Supermercado'} - ${formatCurrency(entry.total)}`;
      listRanking.appendChild(li);
    }
    summary.appendChild(listRanking);

    if (advertencias.size) {
      const promoNote = document.createElement('p');
      promoNote.textContent = `Promos consideradas: ${Array.from(advertencias).join(' · ')}`;
      summary.appendChild(promoNote);
    }

    const detallePromo = document.createElement('p');
    detallePromo.textContent = 'Los totales incluyen prorrateo automático cuando se cumple la cantidad mínima.';
    summary.appendChild(detallePromo);

    const clear = document.createElement('button');
    clear.className = 'button';
    clear.type = 'button';
    clear.textContent = 'Vaciar changuito';
    clear.addEventListener('click', () => {
      vaciarChanguito();
      render();
    });
    summary.appendChild(clear);
  }

  render();
  return container;
}
