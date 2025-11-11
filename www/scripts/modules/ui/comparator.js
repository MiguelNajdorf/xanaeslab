import { formatCurrency, formatDate } from '../utils/format.js';

export function renderComparator(container, items) {
  container.innerHTML = '';
  if (!items.length) {
    container.innerHTML = '<p>No hay resultados para los filtros seleccionados.</p>';
    return;
  }

  for (const item of items) {
    const card = document.createElement('article');
    card.className = 'list-item';
    const header = document.createElement('header');
    const title = document.createElement('div');
    title.innerHTML = `<strong>${item.producto}</strong><br/><small>${item.marca} • ${item.presentacion}</small>`;
    header.append(title);

    if (item.mejorPrecio != null) {
      const price = document.createElement('div');
      price.className = 'price';
      price.textContent = formatCurrency(item.mejorPrecio);
      header.append(price);
    }

    card.append(header);

    const table = document.createElement('table');
    table.className = 'compare-table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Supermercado</th><th>Ciudad</th><th>Precio</th><th>Detalle</th><th>Vigencia</th><th>Fuente</th></tr>';
    table.append(thead);
    const tbody = document.createElement('tbody');

    for (const price of item.precios) {
      const row = document.createElement('tr');
      const promoBadges = [];
      if (price.promo && price.promo !== 'ninguna') {
        promoBadges.push(`<span class="badge badge-promo">${price.promo}</span>`);
      }
      if (price.esBanco) {
        promoBadges.push('<span class="badge badge-warning">Con banco</span>');
      }
      const condicion = price.minCantidad > 1
        ? `<small>Aplica con ${price.minCantidad} unidades</small>`
        : '';

      row.innerHTML = `
        <td>${price.supermercado}</td>
        <td>${price.ciudad}</td>
        <td>${formatCurrency(price.precio)}</td>
        <td>${promoBadges.join(' ')} ${condicion}</td>
        <td>${formatDate(price.vigenciaDesde)} - ${formatDate(price.vigenciaHasta)}</td>
        <td>${price.fuente || '-'}</td>
      `;

      row.addEventListener('click', () => {
        const existing = card.querySelector('.history');
        if (existing) {
          existing.remove();
        }
        const history = document.createElement('div');
        history.className = 'history';
        history.innerHTML = renderHistory(price.historial);
        card.append(history);
        history.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });

      tbody.append(row);
    }

    table.append(tbody);
    card.append(table);
    container.append(card);
  }
}

function renderHistory(entries) {
  if (!entries?.length) {
    return '<p>Sin histórico disponible.</p>';
  }
  const rows = entries
    .slice(0, 5)
    .map((entry) => `
      <tr>
        <td>${formatDate(entry.vigenciaDesde)} - ${formatDate(entry.vigenciaHasta)}</td>
        <td>${formatCurrency(entry.precioEfectivo)}</td>
        <td>${entry.supermercado}</td>
        <td>${entry.fuente || '-'}</td>
      </tr>
    `)
    .join('');
  return `
    <div class="card history">
      <h4>Histórico reciente</h4>
      <div class="table-container">
        <table class="history-table">
          <thead>
            <tr><th>Vigencia</th><th>Precio efectivo</th><th>Supermercado</th><th>Fuente</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}
