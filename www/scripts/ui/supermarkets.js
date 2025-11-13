import { fetchSupermercados, fetchSupermarketsFromApi } from '../store.js';

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
    let supermercados = await fetchSupermarketsFromApi(ciudad);
    if (!supermercados.length) {
      supermercados = await fetchSupermercados(ciudad);
    }
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
    const nombre = supermercado.nombre || supermercado.name || 'Supermercado';
    const direccion = supermercado.direccion || supermercado.address || '';
    const horarios = supermercado.horarios || supermercado.schedule || '';
    const ciudadActual = supermercado.ciudad || ciudad;
    const name = document.createElement('h3');
    name.textContent = nombre;
    const address = document.createElement('p');
    address.textContent = direccion || 'Dirección pendiente';
    const hours = document.createElement('p');
    hours.textContent = horarios || '';
    const button = document.createElement('button');
    button.className = 'button';
    button.type = 'button';
    button.textContent = 'Abrir en Maps';
    button.addEventListener('click', () => {
      const query = `${nombre} ${direccion || ciudadActual}`.trim();
      window.open(supermercado.maps_url || `https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank');
    });
    card.append(name, address);
    if (horarios) card.appendChild(hours);
    card.appendChild(button);
    return card;
  }

  render();
  return container;
}
