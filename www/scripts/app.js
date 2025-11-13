import { ensureSeedData, getSelectedCity, setSelectedCity, getPreferences, purgeVencidas, fetchCities, fetchCategorias } from './store.js';
import { createComparatorView } from './ui/comparator.js';
import { createCartView } from './ui/cartView.js';
import { createSupermarketsView } from './ui/supermarkets.js';
import { createProductDetailView } from './ui/productDetail.js';

let ciudadesDisponibles = [];
const appRoot = document.getElementById('app');
const citySelect = document.getElementById('city-select');
const legalHighlight = document.querySelector('.legal-highlight');

const rateLimitWindow = 60 * 1000;
const rateLimitMax = 60;
const rateLimitLog = [];

window.fetch = createRateLimitedFetch(window.fetch.bind(window));

init();

async function init() {
  await ensureSeedData();
  await cargarCiudades();
  initCitySelect();
  aplicarAjustes();
  await router();
  window.addEventListener('hashchange', router);
}

async function cargarCiudades() {
  try {
    const ciudades = await fetchCities();
    ciudadesDisponibles = ciudades.map(ciudad => ciudad.nombre);
  } catch (error) {
    console.error('No se pudieron cargar las ciudades disponibles', error);
    ciudadesDisponibles = [];
  }
}

function initCitySelect() {
  citySelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Seleccioná ciudad';
  citySelect.appendChild(placeholder);
  if (!ciudadesDisponibles.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No hay ciudades disponibles';
    citySelect.appendChild(option);
    citySelect.setAttribute('disabled', 'disabled');
    return;
  }
  citySelect.removeAttribute('disabled');
  ciudadesDisponibles.forEach(ciudad => {
    const option = document.createElement('option');
    option.value = ciudad;
    option.textContent = ciudad;
    citySelect.appendChild(option);
  });
  citySelect.addEventListener('change', () => {
    const ciudad = citySelect.value;
    if (ciudad) {
      setSelectedCity(ciudad);
      router();
    }
  });
  const seleccionada = getSelectedCity();
  let ciudadInicial = seleccionada;
  if (!ciudadInicial) {
    const prefs = getPreferences();
    const porDefecto = prefs['ajuste:ciudad_defecto'];
    if (porDefecto && ciudadesDisponibles.includes(porDefecto)) {
      ciudadInicial = porDefecto;
    }
  }
  if (!ciudadInicial && ciudadesDisponibles.length) {
    ciudadInicial = ciudadesDisponibles[0];
  }
  if (ciudadInicial && ciudadesDisponibles.includes(ciudadInicial)) {
    citySelect.value = ciudadInicial;
    setSelectedCity(ciudadInicial);
  }
}

async function router() {
  const ciudad = citySelect.value;
  if (!ciudad) {
    renderSeleccionCiudad();
    return;
  }
  const hash = window.location.hash.replace('#', '') || '/';
  if (hash.startsWith('/producto/')) {
    const [, , id] = hash.split('/');
    await renderProductoDetalle(ciudad, Number(id));
    return;
  }
  switch (hash) {
    case '/comparador':
      await renderComparador(ciudad);
      break;
    case '/changuito':
      await renderChanguito(ciudad);
      break;
    case '/supermercados':
      await renderSupermercados(ciudad);
      break;
    case '/':
    default:
      await renderHome(ciudad);
  }
}

function renderSeleccionCiudad() {
  appRoot.textContent = '';
  const aviso = document.createElement('section');
  aviso.className = 'section-card';
  const texto = document.createElement('p');
  if (!ciudadesDisponibles.length) {
    texto.textContent = 'Pronto vamos a habilitar nuevas ciudades. Mientras tanto, podés revisar las funcionalidades del sitio.';
  } else {
    texto.textContent = 'Seleccioná una ciudad para comenzar a comparar precios.';
  }
  aviso.appendChild(texto);
  appRoot.appendChild(aviso);
}

async function renderHome(ciudad) {
  const template = document.getElementById('home-template');
  const clone = template.content.cloneNode(true);
  const legal = clone.querySelector('.legal-highlight');
  legal.textContent = obtenerLeyendaLegal();
  const categoriesGrid = clone.querySelector('.categories-grid');
  if (categoriesGrid) {
    categoriesGrid.innerHTML = '<p class="muted">Cargando categorías…</p>';
  }
  appRoot.textContent = '';
  appRoot.appendChild(clone);
  if (!categoriesGrid) return;
  try {
    const categorias = await fetchCategorias();
    categoriesGrid.textContent = '';
    if (!categorias.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Todavía no hay categorías cargadas.';
      categoriesGrid.appendChild(empty);
      return;
    }
    categorias.slice(0, 6).forEach((categoria) => {
      const button = document.createElement('button');
      button.className = 'category-pill';
      button.dataset.category = categoria.slug || categoria.nombre;
      button.textContent = categoria.nombre || 'Categoría';
      if (categoria.descripcion) {
        button.title = categoria.descripcion;
      }
      button.addEventListener('click', () => {
        window.location.hash = '#/comparador';
      });
      categoriesGrid.appendChild(button);
    });
  } catch (error) {
    console.error('No se pudieron cargar las categorías destacadas', error);
    categoriesGrid.innerHTML = '<p class="muted">No pudimos cargar las categorías. Intentá nuevamente más tarde.</p>';
  }
}

async function renderComparador(ciudad) {
  appRoot.textContent = '';
  purgeVencidas();
  const view = createComparatorView({ ciudad, onOpenProducto: (id) => {
    window.location.hash = `#/producto/${id}`;
  } });
  appRoot.appendChild(view);
}

async function renderChanguito(ciudad) {
  appRoot.textContent = '';
  const view = createCartView({ ciudad });
  appRoot.appendChild(view);
}

async function renderSupermercados(ciudad) {
  appRoot.textContent = '';
  const view = createSupermarketsView({ ciudad });
  appRoot.appendChild(view);
}

async function renderProductoDetalle(ciudad, productoId) {
  appRoot.textContent = '';
  const view = createProductDetailView({ ciudad, productoId, onBack: () => {
    window.location.hash = '#/comparador';
  } });
  appRoot.appendChild(view);
}

function aplicarAjustes() {
  const ajustes = getPreferences();
  if (ajustes['ajuste:legal']) {
    legalHighlight.textContent = ajustes['ajuste:legal'];
  } else {
    legalHighlight.textContent = 'Actualizamos semanalmente según disponibilidad pública de cada supermercado.';
  }
}

function obtenerLeyendaLegal() {
  return legalHighlight?.textContent || '';
}

function createRateLimitedFetch(originalFetch) {
  return async function rateLimitedFetch(input, init) {
    const now = Date.now();
    while (rateLimitLog.length && now - rateLimitLog[0] > rateLimitWindow) {
      rateLimitLog.shift();
    }
    if (rateLimitLog.length >= rateLimitMax) {
      const warning = document.querySelector('.rate-limit-warning');
      if (!warning) {
        const banner = document.createElement('div');
        banner.className = 'rate-limit-warning';
        banner.textContent = 'Alcanzaste el límite de consultas por minuto. Intentá nuevamente en unos instantes.';
        document.body.prepend(banner);
        setTimeout(() => banner.remove(), 4000);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      return rateLimitedFetch(input, init);
    }
    rateLimitLog.push(now);
    return originalFetch(input, init);
  };
}
