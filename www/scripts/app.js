import { initDb, overwriteOffers, listOffers, clearAll, getImportLog, upsertSupermarkets, listSupermarkets, saveCart, loadCart } from './modules/storage/indexed-db.js';
import { getPreferences, savePreferences, getDraftCart, saveDraftCart } from './modules/storage/local-preferences.js';
import { CsvImporter, renderPreviewTable } from './modules/importer/csv-importer.js';
import { LOCAL_SUPERMARKETS } from './modules/data/catalog.js';
import { attachHistory, buildComparatorView, computeCartTotals } from './modules/logic/analytics.js';
import { extractProductIndex } from './modules/logic/products.js';
import { renderComparator } from './modules/ui/comparator.js';
import { renderMapList } from './modules/ui/map.js';
import { renderCartSearchResults, renderCartTotals } from './modules/ui/cart.js';
import { formatDate } from './modules/utils/format.js';

const views = document.querySelectorAll('.view');
const navButtons = document.querySelectorAll('[data-view]');
const importer = new CsvImporter();
let currentImport = null;
let appState = {
  offers: [],
  productsIndex: [],
  cart: [],
  preferences: getPreferences(),
  includeBanks: false
};

(async function bootstrap() {
  try {
    await initDb();
    await upsertSupermarkets(LOCAL_SUPERMARKETS);
    await loadStateFromDb();
    setupNavigation();
    setupImportFlow();
    setupPreferences();
    setupComparator();
    setupCart();
    setupExports();
    setupMap();
    document.getElementById('current-year').textContent = new Date().getFullYear();
    applyPreferencesToUi();
    updateHomeSummary();
    updateComparator();
    updateCartTotals();
  } catch (error) {
    console.error('Error inicializando', error);
    alert('No se pudo inicializar la app. Ver consola para más detalles.');
  }
})();

function setupNavigation() {
  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.view;
      setView(view);
    });
  });
}

function setView(viewId) {
  views.forEach((view) => {
    if (view.id === `view-${viewId}`) {
      view.hidden = false;
      view.setAttribute('tabindex', '-1');
      view.focus({ preventScroll: true });
    } else {
      view.hidden = true;
    }
  });
}

async function loadStateFromDb() {
  const [offers, cartFromDb] = await Promise.all([listOffers(), loadCart()]);
  const offersWithHistory = attachHistory(offers.map(enrichOffer));
  appState.offers = offersWithHistory;
  appState.productsIndex = extractProductIndex(offersWithHistory);
  const draftCart = getDraftCart();
  appState.cart = cartFromDb.length ? cartFromDb : draftCart;
  appState.includeBanks = appState.preferences.incluirBancos;
  await refreshImportInfo();
  await updateMapList();
}

function enrichOffer(offer) {
  return {
    ...offer,
    precioPorBase: offer.precioPorBase ?? offer.precioIndividual / (offer.cantidadBase || 1),
    precioPorBaseEfectivo: offer.precioPorBaseEfectivo ?? offer.precioEfectivo / (offer.cantidadBase || 1)
  };
}

async function refreshImportInfo() {
  const log = await getImportLog(1);
  if (log.length) {
    const last = log[0];
    const timestamp = new Date(last.timestamp);
    const formatted = `${formatDate(timestamp)} ${timestamp.toLocaleTimeString('es-AR')}`;
    document.getElementById('summary-last-import').textContent = formatted;
    document.getElementById('about-last-import').textContent = `${formatted} • ${last.count} ofertas`;
    document.getElementById('about-data-version').textContent = timestamp.toISOString();
    appState.lastImport = last;
  } else {
    document.getElementById('summary-last-import').textContent = '-';
    document.getElementById('about-last-import').textContent = 'No hay datos importados.';
    document.getElementById('about-data-version').textContent = '-';
  }
}

function setupImportFlow() {
  const form = document.getElementById('import-form');
  const fileInput = document.getElementById('import-file');
  const previewTable = document.getElementById('preview-table');
  const previewSummary = document.getElementById('preview-summary');
  const importStats = document.getElementById('import-stats');
  const confirmButton = document.getElementById('confirm-import');
  const errorButton = document.getElementById('download-errors');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!fileInput.files.length) return;
    try {
      const parsed = await importer.parseFile(fileInput.files[0]);
      currentImport = parsed;
      renderPreviewTable({ container: previewTable, headers: parsed.headers, entries: parsed.rows });
      const summary = importer.buildSummary(parsed);
      previewSummary.textContent = `Filas válidas: ${summary.valid}, duplicados: ${summary.duplicates}, rechazados: ${summary.rejected}`;
      importStats.textContent = '';
      confirmButton.disabled = summary.valid === 0;
      errorButton.disabled = summary.rejected === 0;
    } catch (error) {
      previewSummary.textContent = error.message;
      confirmButton.disabled = true;
      errorButton.disabled = true;
    }
  });

  confirmButton.addEventListener('click', async () => {
    if (!currentImport) return;
    const validOffers = currentImport.validRows.map((entry) => normalizeForStorage(entry.row));
    try {
      await overwriteOffers(validOffers, { fileName: fileInput.files[0]?.name || 'manual' });
      currentImport = null;
      confirmButton.disabled = true;
      errorButton.disabled = true;
      document.getElementById('preview-summary').textContent = 'Importación realizada.';
      await loadStateFromDb();
      updateHomeSummary();
      applyPreferencesToUi();
      updateComparator();
      updateCartTotals();
      alert('Datos importados correctamente.');
    } catch (error) {
      console.error(error);
      alert('No se pudo guardar la importación.');
    }
  });

  document.getElementById('import-clear').addEventListener('click', async () => {
    if (confirm('¿Seguro que querés borrar los datos locales?')) {
      await clearAll();
      await loadStateFromDb();
      updateHomeSummary();
      updateComparator();
      updateCartTotals();
      document.getElementById('preview-summary').textContent = 'Base local vacía.';
    }
  });

  errorButton.addEventListener('click', () => {
    if (!currentImport) return;
    const report = importer.buildErrorReport(currentImport.rejected);
    downloadFile('errores-importacion.csv', report);
  });
}

function normalizeForStorage(row) {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${row.supermercado}-${row.producto}-${row.index}-${Date.now()}`;
  return {
    ...row,
    id,
    importadoEl: new Date().toISOString()
  };
}

function setupPreferences() {
  const citySelects = [
    document.getElementById('home-city-select'),
    document.getElementById('compare-city'),
    document.getElementById('preferences-city')
  ];
  for (const select of citySelects) {
    select.innerHTML = ['<option value="">Seleccioná</option>', '<option value="Rio Segundo">Río Segundo</option>', '<option value="Pilar">Pilar</option>'].join('');
  }

  document.getElementById('home-city-select').addEventListener('change', (event) => {
    appState.preferences.ciudad = event.target.value || 'Rio Segundo';
    savePreferences(appState.preferences);
    applyPreferencesToUi();
    updateComparator();
  });

  document.getElementById('home-include-banks').addEventListener('change', (event) => {
    appState.preferences.incluirBancos = event.target.checked;
    savePreferences(appState.preferences);
    applyPreferencesToUi();
    updateComparator();
    updateCartTotals();
  });

  document.getElementById('preferences-city').addEventListener('change', (event) => {
    appState.preferences.ciudad = event.target.value;
    savePreferences(appState.preferences);
    applyPreferencesToUi();
    updateComparator();
  });

  document.getElementById('preferences-include-banks').addEventListener('change', (event) => {
    appState.preferences.incluirBancos = event.target.checked;
    savePreferences(appState.preferences);
    applyPreferencesToUi();
    updateComparator();
    updateCartTotals();
  });

  document.getElementById('preferences-sort').addEventListener('change', (event) => {
    appState.preferences.orden = event.target.value;
    savePreferences(appState.preferences);
    updateComparator();
  });
}

function applyPreferencesToUi() {
  const { ciudad, incluirBancos, orden } = appState.preferences;
  document.getElementById('home-city-select').value = ciudad;
  document.getElementById('compare-city').value = ciudad;
  document.getElementById('preferences-city').value = ciudad;
  document.getElementById('home-include-banks').checked = incluirBancos;
  document.getElementById('compare-include-banks').checked = incluirBancos;
  document.getElementById('preferences-include-banks').checked = incluirBancos;
  document.getElementById('preferences-sort').value = orden;
  appState.includeBanks = incluirBancos;
}

function setupComparator() {
  const compareCity = document.getElementById('compare-city');
  const compareCategory = document.getElementById('compare-category');
  const compareDateFrom = document.getElementById('compare-date-from');
  const compareDateTo = document.getElementById('compare-date-to');
  const compareSearch = document.getElementById('compare-search');
  const includeBanksToggle = document.getElementById('compare-include-banks');
  const rawPricesToggle = document.getElementById('compare-raw-prices');

  compareCity.addEventListener('change', (event) => {
    appState.preferences.ciudad = event.target.value;
    savePreferences(appState.preferences);
    updateComparator();
  });
  const handler = () => updateComparator();
  [compareCategory, compareDateFrom, compareDateTo, compareSearch, includeBanksToggle, rawPricesToggle].forEach((element) => {
    element.addEventListener('input', handler);
  });
  includeBanksToggle.addEventListener('change', () => {
    appState.preferences.incluirBancos = includeBanksToggle.checked;
    appState.includeBanks = includeBanksToggle.checked;
    savePreferences(appState.preferences);
    updateCartTotals();
  });
}


function updateComparator() {
  const compareResults = document.getElementById('compare-results');
  const city = document.getElementById('compare-city').value || appState.preferences.ciudad;
  const category = document.getElementById('compare-category').value || 'todas';
  const dateFrom = document.getElementById('compare-date-from').value || null;
  const dateTo = document.getElementById('compare-date-to').value || null;
  const search = document.getElementById('compare-search').value.trim();
  const includeBanks = document.getElementById('compare-include-banks').checked;
  const rawPrice = document.getElementById('compare-raw-prices').checked;
  const sort = appState.preferences.orden;

  populateCategories();

  const items = buildComparatorView({
    offers: appState.offers,
    city,
    category,
    includeBanks,
    search,
    dateFrom,
    dateTo,
    rawPrice,
    sort
  });
  renderComparator(compareResults, items);
}

function populateCategories() {
  const compareCategory = document.getElementById('compare-category');
  const previous = compareCategory.value || 'todas';
  const categories = ['todas'];
  for (const offer of appState.offers) {
    if (!categories.includes(offer.categoria)) {
      categories.push(offer.categoria);
    }
  }
  compareCategory.innerHTML = categories
    .map((category) => `<option value="${category}">${category === 'todas' ? 'Todas las categorías' : category}</option>`)
    .join('');
  compareCategory.value = categories.includes(previous) ? previous : 'todas';
}

function setupCart() {
  const searchInput = document.getElementById('cart-search');
  const resultsContainer = document.getElementById('cart-search-results');
  const totalsContainer = document.getElementById('cart-totals');

  const handleSearch = () => {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = appState.productsIndex.filter((product) => {
      const haystack = `${product.producto} ${product.marca} ${product.presentacion}`.toLowerCase();
      return haystack.includes(query);
    });
    renderCartSearchResults(resultsContainer, filtered, (item) => {
      appState.cart = mergeCartItems(appState.cart, item);
      saveDraftCart(appState.cart);
      saveCart(appState.cart);
      updateCartTotals();
    });
  };

  searchInput.addEventListener('input', handleSearch);
  handleSearch();
}

function mergeCartItems(cart, item) {
  const existing = cart.find((entry) => entry.producto === item.producto && entry.marca === item.marca && entry.presentacion === item.presentacion);
  if (existing) {
    existing.cantidad += item.cantidad;
  } else {
    cart.push(item);
  }
  return [...cart];
}

function updateCartTotals() {
  const totalsContainer = document.getElementById('cart-totals');
  const note = document.getElementById('cart-note');
  const totals = computeCartTotals({ cartItems: appState.cart, offers: appState.offers, includeBanks: appState.includeBanks });
  renderCartTotals(totalsContainer, totals);
  const promos = totals.flatMap((entry) => entry.detalles.filter((detail) => detail.cantidadCalculada > detail.cantidadSolicitada));
  if (promos.length) {
    note.textContent = 'Algunas promos requieren comprar más unidades de las agregadas. Ajustamos el cálculo automáticamente.';
  } else {
    note.textContent = '';
  }
}

function setupExports() {
  document.getElementById('export-json').addEventListener('click', () => {
    const blob = JSON.stringify(appState.offers, null, 2);
    downloadFile('ofertas-xanaes.json', blob);
  });
  document.getElementById('export-csv').addEventListener('click', () => {
    const headers = [
      'supermercado','ciudad','categoria','producto','marca','presentacion','sku','promo_tipo','promo_param','promo_condicion',
      'precio_individual','precio_total','moneda','vigencia_desde','vigencia_hasta','fuente','id_externo','pagina','posicion',
      'cantidad_base','unidad_base','precio_por_base','precio_efectivo','precio_por_base_efectivo','min_cantidad_promo','es_banco'
    ];
    const lines = [headers.join(',')];
    for (const offer of appState.offers) {
      lines.push([
        offer.supermercado,
        offer.ciudad,
        offer.categoria,
        offer.producto,
        offer.marca,
        offer.presentacion,
        offer.sku,
        offer.promoTipo,
        offer.promoParam,
        offer.promoCondicion,
        offer.precioIndividual,
        offer.precioTotal,
        offer.moneda,
        offer.vigenciaDesde,
        offer.vigenciaHasta,
        offer.fuente,
        offer.idExterno,
        offer.pagina,
        offer.posicion,
        offer.cantidadBase,
        offer.unidadBase,
        offer.precioPorBase,
        offer.precioEfectivo,
        offer.precioPorBaseEfectivo,
        offer.minCantidadPromo,
        offer.esBanco
      ].map((value) => formatCsvValue(value)).join(','));
    }
    downloadFile('ofertas-xanaes.csv', lines.join('\n'));
  });
}

function formatCsvValue(value) {
  if (value == null) return '';
  const text = String(value).replace(/"/g, '""');
  if (text.includes(',') || text.includes('\n')) {
    return `"${text}"`;
  }
  return text;
}

function setupMap() {
  updateMapList();
}

async function updateMapList() {
  const catalog = await listSupermarkets();
  renderMapList(document.getElementById('map-list'), catalog);
}

function updateHomeSummary() {
  document.getElementById('summary-offers-count').textContent = appState.offers.length;
  document.getElementById('summary-products-count').textContent = appState.productsIndex.length;
}

function downloadFile(filename, data) {
  const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
