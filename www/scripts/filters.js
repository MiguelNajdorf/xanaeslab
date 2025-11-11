import { getPreferences, setPreference } from './store.js';

const FILTER_STATE_KEY = 'filters';

function loadFilterState() {
  const prefs = getPreferences();
  return prefs[FILTER_STATE_KEY] || {};
}

function persistFilterState(state) {
  setPreference(FILTER_STATE_KEY, state);
}

const filterState = {
  ...loadFilterState(),
  texto: '',
  categoria: '',
  marca: '',
  presentacion: '',
  vigenciaDesde: '',
  vigenciaHasta: '',
};

export function getFilterState() {
  return { ...filterState };
}

export function updateFilterState(partial) {
  Object.assign(filterState, partial);
  persistFilterState(filterState);
}

export function clearFilters() {
  filterState.texto = '';
  filterState.categoria = '';
  filterState.marca = '';
  filterState.presentacion = '';
  filterState.vigenciaDesde = '';
  filterState.vigenciaHasta = '';
  persistFilterState(filterState);
}

function tokenize(text) {
  return text
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

export function fuzzyScore(haystack, needle) {
  if (!needle) return 1;
  const hayTokens = tokenize(haystack);
  const needleTokens = tokenize(needle);
  let totalScore = 0;
  for (const token of needleTokens) {
    const index = hayTokens.findIndex(t => t.includes(token));
    if (index === -1) return 0;
    const closeness = hayTokens[index].startsWith(token) ? 1 : 0.5;
    totalScore += closeness;
  }
  return totalScore / needleTokens.length;
}

export function filterOffers(ofertas, state, ciudad) {
  const ahora = new Date();
  return ofertas.filter(oferta => {
    if (ciudad && oferta.ciudad !== ciudad) return false;
    if (state.categoria && oferta.categoria !== state.categoria) return false;
    if (state.marca && oferta.marca !== state.marca) return false;
    if (state.presentacion && oferta.presentacion !== state.presentacion) return false;
    if (state.vigenciaDesde && new Date(oferta.vigencia_hasta) < new Date(state.vigenciaDesde)) return false;
    if (state.vigenciaHasta && new Date(oferta.vigencia_desde) > new Date(state.vigenciaHasta)) return false;
    if (new Date(oferta.vigencia_hasta) < ahora) return false;
    if (state.texto) {
      const score = fuzzyScore(`${oferta.producto} ${oferta.marca} ${oferta.presentacion}`, state.texto);
      return score > 0;
    }
    return true;
  });
}

export function debounce(fn, wait = 300) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}
