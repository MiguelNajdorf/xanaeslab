import { formatCurrency } from '../utils/format.js';

export function renderCartSearchResults(container, products, onAdd) {
  container.innerHTML = '';
  if (!products.length) {
    container.innerHTML = '<p>No se encontraron productos. Importá ofertas o cambiá los filtros.</p>';
    return;
  }
  for (const product of products.slice(0, 20)) {
    const card = document.createElement('article');
    card.className = 'list-item';
    const header = document.createElement('header');
    header.innerHTML = `<strong>${product.producto}</strong><small>${product.marca} • ${product.presentacion}</small>`;
    const action = document.createElement('div');
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.value = '1';
    input.setAttribute('aria-label', `Cantidad para ${product.producto}`);
    const button = document.createElement('button');
    button.className = 'primary';
    button.textContent = 'Agregar';
    button.addEventListener('click', () => {
      onAdd({ ...product, cantidad: Number.parseInt(input.value, 10) || 1 });
    });
    action.append(input, button);
    header.append(action);
    card.append(header);
    card.append(document.createElement('hr'));
    const detail = document.createElement('p');
    detail.innerHTML = `<small>Mejor precio: ${formatCurrency(product.precioEfectivo)} (${product.supermercado})</small>`;
    card.append(detail);
    container.append(card);
  }
}

export function renderCartTotals(container, totals) {
  container.innerHTML = '';
  if (!totals.length) {
    container.innerHTML = '<p>Agregá productos al changuito para ver comparativa.</p>';
    return;
  }
  for (const entry of totals) {
    const card = document.createElement('article');
    card.className = 'list-item';
    card.innerHTML = `
      <header>
        <strong>${entry.supermercado}</strong>
        <span class="price">${formatCurrency(entry.total)}</span>
      </header>
      <ul>
        ${entry.detalles
          .map((detail) => {
            const ajuste = detail.cantidadCalculada > detail.cantidadSolicitada
              ? `<small> • Se calcularon ${detail.cantidadCalculada} u por promo</small>`
              : '';
            const promo = detail.minCantidad > 1 ? `<small> • Promo desde ${detail.minCantidad} u</small>` : '';
            const banco = detail.esBanco ? '<small> • Requiere banco</small>' : '';
            return `
              <li>
                ${detail.producto} (${detail.cantidadSolicitada} u) - ${formatCurrency(detail.total)}
                <small> • ${formatCurrency(detail.precioUnidad)} c/u</small>
                ${promo} ${ajuste} ${banco}
              </li>
            `;
          })
          .join('')}
      </ul>
    `;
    container.append(card);
  }
}
