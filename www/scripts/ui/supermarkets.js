import { fetchPublicSupermarkets } from '../store.js';

export function createSupermarketsView({ onSelectSupermercado }) {
  const container = document.createElement('section');
  container.className = 'section-card supermarkets-view';

  const title = document.createElement('h2');
  title.textContent = 'Supermercados disponibles';
  container.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'supermarkets-list';
  list.setAttribute('role', 'list');
  container.appendChild(list);

  render();

  async function render() {
    list.textContent = '';
    const loading = document.createElement('p');
    loading.className = 'muted';
    loading.textContent = 'Cargando supermercados…';
    list.appendChild(loading);

    try {
      const supermercados = await fetchPublicSupermarkets();
      list.textContent = '';

      if (!supermercados.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'Todavía no hay supermercados activos disponibles.';
        list.appendChild(empty);
        return;
      }

      supermercados.forEach((supermercado) => {
        list.appendChild(renderItem(supermercado));
      });
    } catch (error) {
      console.error('No se pudieron cargar los supermercados', error);
      list.textContent = '';
      const failure = document.createElement('p');
      failure.className = 'muted';
      failure.textContent = 'No pudimos obtener la lista de supermercados. Intentá nuevamente más tarde.';
      list.appendChild(failure);
    }
  }

  function renderItem(supermercado) {
    const item = document.createElement('li');
    item.className = 'supermarket-row';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'supermarket-button';
    button.textContent = buildDisplay(supermercado);
    button.addEventListener('click', () => {
      onSelectSupermercado?.(supermercado);
    });

    item.appendChild(button);
    return item;
  }

  function buildDisplay(supermercado) {
    const nombre = supermercado.nombre?.trim() || 'Supermercado';
    const direccion = supermercado.direccion?.trim() || '';
    const ciudad = supermercado.ciudad?.trim() || '';
    const direccionSegment = direccion || '—';
    const ciudadSegment = ciudad || '—';
    return `${nombre} - ${direccionSegment} - ${ciudadSegment}`;
  }

  return container;
}
