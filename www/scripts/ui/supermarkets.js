import { fetchSupermercados } from '../store.js';

export function createSupermarketsView({ ciudad }) {
  const container = document.createElement('section');
  container.className = 'section-card supermarkets-view';
  const title = document.createElement('h2');
  title.textContent = `Supermercados en ${ciudad}`;
  container.appendChild(title);

  const list = document.createElement('div');
  list.className = 'card-grid';
  container.appendChild(list);

  async function render() {
    list.textContent = '';
    const supermercados = await fetchSupermercados(ciudad);
    if (!supermercados.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Aún no hay supermercados cargados para esta ciudad.';
      list.appendChild(empty);
      return;
    }
    for (const supermercado of supermercados) {
      list.appendChild(renderCard(supermercado));
    }
  }

  function renderCard(supermercado) {
    const card = document.createElement('article');
    card.className = 'map-card';
    const name = document.createElement('h3');
    name.textContent = supermercado.nombre;
    const address = document.createElement('p');
    address.textContent = supermercado.direccion || 'Dirección pendiente';
    const hours = document.createElement('p');
    hours.textContent = supermercado.horarios || '';
    const button = document.createElement('button');
    button.className = 'button';
    button.type = 'button';
    button.textContent = 'Abrir en Maps';
    button.addEventListener('click', () => {
      window.open(supermercado.maps_url || `https://www.google.com/maps/search/${encodeURIComponent(supermercado.nombre + ' ' + (supermercado.direccion || ciudad))}`, '_blank');
    });
    card.append(name, address);
    if (supermercado.horarios) card.appendChild(hours);
    card.appendChild(button);
    return card;
  }

  render();
  return container;
}
