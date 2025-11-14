import { obtenerComparaciones, mapComparacionToCard } from '../compare.js';
import { formatCurrency } from '../format.js';
import { getFilterState, updateFilterState, debounce, clearFilters } from '../filters.js';
import { agregarAListaDeCompras } from '../cart.js';

export function createComparatorView({ ciudad, onNavigate, onOpenProducto }) {
  const container = document.createElement('section');
  container.className = 'section-card comparator-view';

  const header = document.createElement('div');
  header.className = 'section-title';
  const title = document.createElement('h2');
  title.textContent = 'Comparador de ofertas';
  header.appendChild(title);
  const clearBtn = document.createElement('button');
  clearBtn.className = 'button-tertiary';
  clearBtn.type = 'button';
  clearBtn.textContent = 'Limpiar filtros';
  clearBtn.addEventListener('click', () => {
    clearFilters();
    render();
  });
  header.appendChild(clearBtn);

  const searchBar = document.createElement('div');
  searchBar.className = 'search-bar';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Buscar producto, marca o presentación';
  searchInput.className = 'search-input';
  searchInput.value = getFilterState().texto || '';
  const debouncedSearch = debounce(() => {
    updateFilterState({ texto: searchInput.value });
    renderResultados();
  });
  searchInput.addEventListener('input', debouncedSearch);
  searchBar.appendChild(searchInput);

  const filtersBar = document.createElement('div');
  filtersBar.className = 'filter-bar';
  const selectCategoria = createSelect('Categoría', 'categoria');
  const selectMarca = createSelect('Marca', 'marca');
  const selectPresentacion = createSelect('Presentación', 'presentacion');

  const vigenciaDesde = document.createElement('input');
  vigenciaDesde.type = 'date';
  vigenciaDesde.className = 'filter-select';
  vigenciaDesde.value = getFilterState().vigenciaDesde || '';
  vigenciaDesde.addEventListener('change', () => {
    updateFilterState({ vigenciaDesde: vigenciaDesde.value });
    renderResultados();
  });

  const vigenciaHasta = document.createElement('input');
  vigenciaHasta.type = 'date';
  vigenciaHasta.className = 'filter-select';
  vigenciaHasta.value = getFilterState().vigenciaHasta || '';
  vigenciaHasta.addEventListener('change', () => {
    updateFilterState({ vigenciaHasta: vigenciaHasta.value });
    renderResultados();
  });

  filtersBar.append(selectCategoria.container, selectMarca.container, selectPresentacion.container, vigenciaDesde, vigenciaHasta);

  const resultados = document.createElement('div');
  resultados.className = 'card-grid';

  container.append(header, searchBar, filtersBar, resultados);

  let ultimoRender = [];

  async function render() {
    searchInput.value = getFilterState().texto || '';
    selectCategoria.select.value = getFilterState().categoria || '';
    selectMarca.select.value = getFilterState().marca || '';
    selectPresentacion.select.value = getFilterState().presentacion || '';
    vigenciaDesde.value = getFilterState().vigenciaDesde || '';
    vigenciaHasta.value = getFilterState().vigenciaHasta || '';
    await renderResultados();
  }

  async function renderResultados() {
    resultados.textContent = '';
    const loader = document.createElement('p');
    loader.textContent = 'Buscando ofertas vigentes…';
    resultados.appendChild(loader);
    const comparaciones = await obtenerComparaciones(ciudad);
    ultimoRender = comparaciones;
    resultados.textContent = '';
    if (!comparaciones.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No encontramos ofertas para los filtros seleccionados.';
      resultados.appendChild(empty);
      return;
    }
    const categorias = new Set();
    const marcas = new Set();
    const presentaciones = new Set();
    for (const comparacion of comparaciones) {
      categorias.add(comparacion.producto.categoria);
      marcas.add(comparacion.producto.marca);
      presentaciones.add(comparacion.producto.presentacion);
      resultados.appendChild(renderCard(comparacion));
    }
    updateSelectOptions(selectCategoria.select, categorias);
    updateSelectOptions(selectMarca.select, marcas);
    updateSelectOptions(selectPresentacion.select, presentaciones);
  }

  function renderCard(comparacion) {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.tabIndex = 0;
    const data = mapComparacionToCard(comparacion);
    const title = document.createElement('h3');
    title.textContent = data.titulo;
    const presentacion = document.createElement('p');
    presentacion.textContent = data.presentacion;
    presentacion.className = 'muted';
    const precio = document.createElement('span');
    precio.className = 'price-main';
    precio.textContent = data.mejorPrecio;
    const unitario = document.createElement('span');
    unitario.className = 'price-unit';
    unitario.textContent = data.precioBase ? data.precioBase : 'Precio por unidad disponible';
    const badges = document.createElement('div');
    badges.className = 'list-inline';
    if (data.badge) {
      const badge = document.createElement('span');
      badge.className = 'badge badge-promo';
      badge.textContent = data.badge;
      badges.appendChild(badge);
    }
    if (data.empate) {
      const badge = document.createElement('span');
      badge.className = 'badge badge-equal';
      badge.textContent = 'Igual precio';
      badges.appendChild(badge);
    }
    const actions = document.createElement('div');
    actions.className = 'actions';
    const verDetalle = document.createElement('button');
    verDetalle.className = 'button';
    verDetalle.type = 'button';
    verDetalle.textContent = 'Ver otros súper';
    verDetalle.addEventListener('click', () => {
      const id = comparacion.producto.producto_id || comparacion.producto.id;
      onOpenProducto(id);
    });
    const agregarBtn = document.createElement('button');
    agregarBtn.className = 'button-tertiary';
    agregarBtn.type = 'button';
    agregarBtn.textContent = 'Agregar a la lista de compras';
    agregarBtn.addEventListener('click', () => {
      const id = comparacion.producto.producto_id || comparacion.producto.id;
      agregarAListaDeCompras({ producto_id: id, cantidad: 1, descripcion: data.titulo });
      const aviso = document.createElement('span');
      aviso.textContent = 'Agregado';
      aviso.setAttribute('role', 'status');
      aviso.className = 'badge badge-promo';
      actions.appendChild(aviso);
      setTimeout(() => aviso.remove(), 1500);
    });
    actions.append(verDetalle, agregarBtn);

    card.append(title, presentacion, precio, unitario, badges, actions);
    return card;
  }

  function createSelect(labelText, key) {
    const container = document.createElement('label');
    container.className = 'filter-select';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.fontSize = '0.85rem';
    const label = document.createElement('span');
    label.textContent = labelText;
    const select = document.createElement('select');
    select.className = 'filter-select';
    select.innerHTML = '<option value="">Todas</option>';
    select.value = getFilterState()[key] || '';
    select.addEventListener('change', () => {
      updateFilterState({ [key]: select.value });
      renderResultados();
    });
    container.append(label, select);
    return { container, select };
  }

  function updateSelectOptions(select, values) {
    const current = new Set();
    Array.from(select.options).forEach(option => current.add(option.value));
    let shouldRefresh = false;
    for (const value of values) {
      if (!current.has(value)) {
        shouldRefresh = true;
        break;
      }
    }
    if (!shouldRefresh) return;
    const keep = select.value;
    select.innerHTML = '<option value="">Todas</option>';
    Array.from(values).filter(Boolean).sort().forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    select.value = keep;
  }

  render();
  return container;
}
