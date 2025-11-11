import {
  initDb,
  listOffers,
  listSupermarkets,
  upsertSupermarkets,
  upsertOffer,
  deleteOffer,
  getImportLog
} from '../scripts/modules/storage/indexed-db.js';
import { deriveBaseQuantity, calculatePromoPrice } from '../scripts/modules/utils/normalization.js';
import { extractProductIndex } from '../scripts/modules/logic/products.js';
import { formatDate, formatCurrency } from '../scripts/modules/utils/format.js';

const panels = document.querySelectorAll('.panel');
const navButtons = document.querySelectorAll('[data-panel]');
const state = {
  offers: [],
  supermarkets: [],
  products: []
};

(async function bootstrap() {
  await initDb();
  await refreshData();
  setupNavigation();
  setupSupermarketForm();
  setupOfferForm();
  setupFilters();
})();

function setupNavigation() {
  navButtons.forEach((button) => {
    button.addEventListener('click', () => showPanel(button.dataset.panel));
  });
}

function showPanel(id) {
  panels.forEach((panel) => {
    panel.hidden = panel.id !== `panel-${id}`;
  });
}

async function refreshData() {
  const [offers, supermarkets, importLog] = await Promise.all([
    listOffers(),
    listSupermarkets(),
    getImportLog(1)
  ]);
  state.offers = offers;
  state.supermarkets = supermarkets;
  state.products = extractProductIndex(offers);
  updateStats(importLog[0]);
  renderSupermarkets();
  renderOffers();
  renderProducts();
}

function updateStats(lastImport) {
  document.getElementById('admin-stats-offers').textContent = state.offers.length;
  document.getElementById('admin-stats-supermarkets').textContent = state.supermarkets.length;
  if (lastImport) {
    const timestamp = new Date(lastImport.timestamp);
    document.getElementById('admin-stats-import').textContent = `${formatDate(timestamp)} ${timestamp.toLocaleTimeString('es-AR')}`;
  } else {
    document.getElementById('admin-stats-import').textContent = '-';
  }
}

function setupSupermarketForm() {
  const form = document.getElementById('form-supermarket');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const supermarket = {
      id: buildSupermarketId(formData.get('nombre'), formData.get('ciudad')),
      nombre: formData.get('nombre'),
      ciudad: formData.get('ciudad'),
      direccion: formData.get('direccion'),
      telefono: formData.get('telefono'),
      mapsUrl: formData.get('mapsUrl')
    };
    await upsertSupermarkets([supermarket]);
    form.reset();
    await refreshData();
  });
  document.getElementById('admin-refresh').addEventListener('click', refreshData);
}

function buildSupermarketId(name, city) {
  return `${slugify(name)}-${slugify(city)}`;
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function renderSupermarkets() {
  const container = document.getElementById('list-supermarkets');
  container.innerHTML = '';
  if (!state.supermarkets.length) {
    container.innerHTML = '<p>No hay supermercados cargados.</p>';
    return;
  }
  state.supermarkets.forEach((supermarket) => {
    const card = document.createElement('article');
    card.className = 'list-item';
    card.innerHTML = `
      <header><strong>${supermarket.nombre}</strong><small>${supermarket.ciudad}</small></header>
      <p>${supermarket.direccion}</p>
      <small>${supermarket.telefono || ''}</small>
    `;
    container.append(card);
  });
}

function setupOfferForm() {
  const form = document.getElementById('form-offer');
  const resetBtn = document.getElementById('offer-reset');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const offer = collectOffer(form);
    await upsertOffer(offer);
    form.reset();
    await refreshData();
  });
  resetBtn.addEventListener('click', () => form.reset());
}

function collectOffer(form) {
  const formData = new FormData(form);
  const cantidadBase = Number.parseFloat(formData.get('cantidadBase')) || 0;
  const unidadBase = formData.get('unidadBase') || 'u';
  const precioIndividual = Number.parseFloat(formData.get('precioIndividual')) || 0;
  let precioTotal = Number.parseFloat(formData.get('precioTotal'));
  if (!Number.isFinite(precioTotal)) {
    precioTotal = precioIndividual;
  }
  const promoTipo = formData.get('promoTipo') || 'ninguna';
  const promoParam = formData.get('promoParam') || '';
  const promoCondicion = formData.get('promoCondicion') || '';
  const { precioEfectivo, minCantidad } = calculatePromoPrice({
    tipo: promoTipo,
    precioIndividual,
    precioTotal,
    promoParam,
    promoCondicion
  });
  const derived = deriveBaseQuantity({
    presentacion: formData.get('presentacion'),
    sku_presentacion_capturada: formData.get('sku')
  });
  const baseQuantity = cantidadBase || derived.amount;
  const baseUnit = unidadBase || derived.unit;
  const minCantidadPromo = Number.parseInt(formData.get('minCantidadPromo'), 10) || minCantidad;
  const id = formData.get('id') || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`);

  return {
    id,
    supermercado: formData.get('supermercado'),
    ciudad: formData.get('ciudad'),
    categoria: formData.get('categoria'),
    producto: formData.get('producto'),
    marca: formData.get('marca'),
    presentacion: formData.get('presentacion'),
    sku: formData.get('sku'),
    promoTipo,
    promoParam,
    promoCondicion,
    precioIndividual,
    precioTotal,
    moneda: formData.get('moneda') || 'ARS',
    vigenciaDesde: formData.get('vigenciaDesde'),
    vigenciaHasta: formData.get('vigenciaHasta'),
    fuente: formData.get('fuente'),
    idExterno: formData.get('idExterno'),
    pagina: formData.get('pagina'),
    posicion: formData.get('posicion'),
    cantidadBase: baseQuantity,
    unidadBase: baseUnit,
    precioPorBase: precioIndividual / (baseQuantity || 1),
    precioEfectivo,
    precioPorBaseEfectivo: precioEfectivo / (baseQuantity || 1),
    minCantidadPromo,
    esBanco: formData.get('esBanco') === 'true',
    importadoEl: new Date().toISOString()
  };
}

function renderOffers(filter = '') {
  const tbody = document.querySelector('#table-offers tbody');
  tbody.innerHTML = '';
  const term = filter.toLowerCase();
  const filtered = state.offers.filter((offer) => {
    if (!term) return true;
    const haystack = `${offer.producto} ${offer.marca} ${offer.supermercado}`.toLowerCase();
    return haystack.includes(term);
  });
  if (!filtered.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.textContent = 'Sin resultados.';
    row.append(cell);
    tbody.append(row);
    return;
  }
  filtered.forEach((offer) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${offer.producto}</td>
      <td>${offer.marca}</td>
      <td>${offer.supermercado}</td>
      <td>${offer.ciudad}</td>
      <td>${formatCurrency(offer.precioEfectivo || offer.precioIndividual)}</td>
      <td>${offer.vigenciaDesde} - ${offer.vigenciaHasta}</td>
      <td>
        <button data-action="edit" data-id="${offer.id}">Editar</button>
        <button data-action="delete" data-id="${offer.id}">Eliminar</button>
      </td>
    `;
    tbody.append(row);
  });
  tbody.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', (event) => handleOfferAction(event.target.dataset));
  });
}

function handleOfferAction({ action, id }) {
  const offer = state.offers.find((item) => item.id === id);
  if (!offer) return;
  if (action === 'edit') {
    fillOfferForm(offer);
  } else if (action === 'delete') {
    if (confirm('¿Eliminar esta oferta?')) {
      deleteOffer(id).then(refreshData);
    }
  }
}

function fillOfferForm(offer) {
  const form = document.getElementById('form-offer');
  Object.entries(offer).forEach(([key, value]) => {
    if (form.elements[key] !== undefined) {
      form.elements[key].value = value ?? '';
    }
  });
  form.elements.esBanco.value = offer.esBanco ? 'true' : 'false';
}

function setupFilters() {
  document.getElementById('search-offers').addEventListener('input', (event) => {
    renderOffers(event.target.value);
  });
  document.getElementById('search-products').addEventListener('input', (event) => {
    renderProducts(event.target.value);
  });
}

function renderProducts(filter = '') {
  const container = document.getElementById('list-products');
  container.innerHTML = '';
  const term = filter.toLowerCase();
  const filtered = state.products.filter((product) => {
    if (!term) return true;
    const haystack = `${product.producto} ${product.marca} ${product.presentacion}`.toLowerCase();
    return haystack.includes(term);
  });
  if (!filtered.length) {
    container.innerHTML = '<p>Sin productos disponibles.</p>';
    return;
  }
  filtered.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'list-item';
    card.innerHTML = `
      <header><strong>${product.producto}</strong><small>${product.marca}</small></header>
      <p>${product.presentacion}</p>
      <small>Mejor precio: ${formatCurrency(product.precioEfectivo)} en ${product.supermercado}</small>
    `;
    container.append(card);
  });
}
