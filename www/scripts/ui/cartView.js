import { listarListaDeCompras, actualizarCantidad, eliminarDeListaDeCompras, vaciarListaDeCompras } from '../cart.js';
import { fetchPublicSupermarkets, fetchOffersForSupermarket, computeEffectivePrice } from '../store.js';
import { promoMinimumQuantity } from '../format.js';
import { formatCurrency } from '../format.js';

export function createShoppingListView() {
  const container = document.createElement('section');
  container.className = 'section-card cart-view';

  const title = document.createElement('h2');
  title.textContent = 'Lista de compras';
  container.appendChild(title);

  const list = document.createElement('div');
  list.className = 'cart-list';
  container.appendChild(list);

  const summary = document.createElement('div');
  summary.className = 'cart-summary';
  container.appendChild(summary);

  render();

  async function render() {
    const items = listarListaDeCompras();
    list.textContent = '';
    if (!items.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Tu lista de compras está vacía. Sumá productos desde las ofertas de cada supermercado.';
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

    const qtyLabel = document.createElement('label');
    qtyLabel.className = 'sr-only';
    qtyLabel.textContent = 'Cantidad';
    qtyLabel.htmlFor = `qty-${item.producto_id}`;

    const qty = document.createElement('input');
    qty.type = 'number';
    qty.min = '1';
    qty.value = item.cantidad;
    qty.id = `qty-${item.producto_id}`;
    qty.addEventListener('change', () => {
      const value = Number.parseInt(qty.value, 10);
      actualizarCantidad(item.producto_id, Number.isFinite(value) ? value : 1);
      render();
    });

    const remove = document.createElement('button');
    remove.className = 'button-tertiary';
    remove.type = 'button';
    remove.textContent = 'Quitar';
    remove.addEventListener('click', () => {
      eliminarDeListaDeCompras(item.producto_id);
      render();
    });

    row.append(desc, qtyLabel, qty, remove);
    return row;
  }

  async function renderSummary(items) {
    summary.textContent = '';
    if (!items.length) return;

    const supermercados = await fetchPublicSupermarkets();
    const ofertasPorSuper = await Promise.all(supermercados.map(async (supermercado) => {
      const ofertas = await fetchOffersForSupermarket(supermercado.id);
      return [supermercado.id, ofertas];
    }));
    const mapaOfertas = new Map(ofertasPorSuper);
    const superMap = new Map(supermercados.map(s => [s.id, s]));

    const totales = new Map();
    const advertencias = new Set();

    for (const item of items) {
      for (const [superId, ofertas] of mapaOfertas.entries()) {
        const oferta = ofertas.find(o => o.producto_id === item.producto_id);
        if (!oferta) continue;
        const minimo = oferta.min_cantidad_para_promo || promoMinimumQuantity(oferta) || 1;
        const aplicaPromo = item.cantidad >= minimo;
        if (minimo > 1) {
          const mensaje = aplicaPromo
            ? `${oferta.producto}: llevando ${minimo}`
            : `${oferta.producto}: promo requiere llevar ${minimo}`;
          advertencias.add(mensaje);
        }
        const precioUnitario = aplicaPromo ? computeEffectivePrice(oferta, true) : oferta.precio_individual;
        const totalActual = totales.get(superId) || 0;
        totales.set(superId, totalActual + precioUnitario * item.cantidad);
      }
    }

    const ordenados = Array.from(totales.entries())
      .map(([id, total]) => ({ id, total }))
      .sort((a, b) => a.total - b.total)
      .slice(0, 3);

    if (!ordenados.length) {
      const aviso = document.createElement('p');
      aviso.className = 'muted';
      aviso.textContent = 'Todavía no hay precios disponibles para calcular el ranking.';
      summary.appendChild(aviso);
      return;
    }

    const heading = document.createElement('h3');
    heading.textContent = 'Top 3 supermercados';
    summary.appendChild(heading);

    const listRanking = document.createElement('ol');
    listRanking.className = 'cart-ranking';
    ordenados.forEach((entry) => {
      const li = document.createElement('li');
      const superInfo = superMap.get(entry.id);
      li.textContent = `${superInfo?.nombre || 'Supermercado'} - ${formatCurrency(entry.total)}`;
      listRanking.appendChild(li);
    });
    summary.appendChild(listRanking);

    if (advertencias.size) {
      const promoNote = document.createElement('p');
      promoNote.className = 'muted';
      promoNote.textContent = `Promos consideradas: ${Array.from(advertencias).join(' · ')}`;
      summary.appendChild(promoNote);
    }

    const detallePromo = document.createElement('p');
    detallePromo.className = 'muted';
    detallePromo.textContent = 'Los totales incluyen prorrateo automático cuando se cumple la cantidad mínima de cada promo.';
    summary.appendChild(detallePromo);

    const clear = document.createElement('button');
    clear.className = 'button';
    clear.type = 'button';
    clear.textContent = 'Vaciar lista de compras';
    clear.addEventListener('click', () => {
      vaciarListaDeCompras();
      render();
    });
    summary.appendChild(clear);
  }

  return container;
}
