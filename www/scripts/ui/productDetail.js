import { fetchOfertasPorCiudad, fetchSupermercados, computeEffectivePrice, computeEffectiveUnitPrice } from '../store.js';
import { formatCurrency, formatDateISO } from '../format.js';

export function createProductDetailView({ ciudad, productoId, onBack }) {
  const container = document.createElement('section');
  container.className = 'section-card product-detail';
  const back = document.createElement('button');
  back.className = 'button-tertiary';
  back.type = 'button';
  back.textContent = 'Volver al comparador';
  back.addEventListener('click', onBack);
  container.appendChild(back);

  const title = document.createElement('h2');
  title.textContent = 'Detalle de producto';
  container.appendChild(title);

  const toggleContainer = document.createElement('label');
  toggleContainer.className = 'toggle';
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggleContainer.appendChild(toggle);
  toggleContainer.append(' Ver con prorrateo');
  container.appendChild(toggleContainer);

  const table = document.createElement('table');
  table.className = 'table';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Supermercado</th><th>Precio</th><th>Precio base</th><th>Vigencia</th><th>Promo</th><th>Fuente</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  container.appendChild(table);

  const historico = document.createElement('section');
  historico.className = 'section-card';
  const historicoTitle = document.createElement('h3');
  historicoTitle.textContent = 'Histórico reciente';
  historico.appendChild(historicoTitle);
  const historicoList = document.createElement('ul');
  historico.appendChild(historicoList);
  container.appendChild(historico);

  const aclaracion = document.createElement('p');
  aclaracion.textContent = 'Los precios prorrateados consideran llevar la cantidad mínima indicada en la promo ("llevando N").';
  container.appendChild(aclaracion);

  async function render() {
    const ofertas = await fetchOfertasPorCiudad(ciudad);
    const supermercados = await fetchSupermercados(ciudad);
    const superMap = new Map(supermercados.map(s => [s.id, s]));
    const delProducto = ofertas.filter(oferta => oferta.producto_id === productoId);
    if (!delProducto.length) {
      title.textContent = 'No encontramos datos para este producto.';
      table.hidden = true;
      historico.hidden = true;
      return;
    }
    title.textContent = `${delProducto[0].producto} ${delProducto[0].marca}`.trim();
    renderTabla(delProducto, superMap);
    renderHistorico(delProducto);
  }

  function renderTabla(ofertas, superMap) {
    tbody.textContent = '';
    const prorrateo = toggle.checked;
    const ordenadas = ofertas
      .filter(oferta => new Date(oferta.vigencia_hasta) >= new Date())
      .sort((a, b) => computeEffectivePrice(a, prorrateo) - computeEffectivePrice(b, prorrateo));
    for (const oferta of ordenadas) {
      const tr = document.createElement('tr');
      const tdSuper = document.createElement('td');
      tdSuper.textContent = superMap.get(oferta.supermercado_id)?.nombre || oferta.supermercado;
      const tdPrecio = document.createElement('td');
      const precio = computeEffectivePrice(oferta, prorrateo);
      tdPrecio.textContent = formatCurrency(precio);
      const tdBase = document.createElement('td');
      const base = computeEffectiveUnitPrice(oferta, prorrateo);
      tdBase.textContent = base ? `${formatCurrency(base)} / ${oferta.unidad_base}` : '—';
      const tdVigencia = document.createElement('td');
      tdVigencia.textContent = `${formatDateISO(oferta.vigencia_desde)} - ${formatDateISO(oferta.vigencia_hasta)}`;
      const tdPromo = document.createElement('td');
      tdPromo.innerHTML = `${oferta.promo_tipo !== 'ninguna' ? `<span class="badge badge-promo">${oferta.promo_tipo}</span>` : '—'} ${oferta.promo_condicion ? `<small>${oferta.promo_condicion}</small>` : ''}`;
      const tdFuente = document.createElement('td');
      tdFuente.textContent = oferta.fuente || 'Revista';
      tr.append(tdSuper, tdPrecio, tdBase, tdVigencia, tdPromo, tdFuente);
      tbody.appendChild(tr);
    }
  }

  function renderHistorico(ofertas) {
    historicoList.textContent = '';
    const ordenadas = ofertas
      .slice()
      .sort((a, b) => new Date(b.vigencia_desde) - new Date(a.vigencia_desde))
      .slice(0, 8);
    for (const oferta of ordenadas) {
      const li = document.createElement('li');
      li.textContent = `${formatDateISO(oferta.vigencia_desde)}: ${formatCurrency(oferta.precio_individual)} (${oferta.supermercado})`;
      historicoList.appendChild(li);
    }
  }

  toggle.addEventListener('change', () => render());

  render();
  return container;
}
