import { ensureSeedData, getPreferences, purgeVencidas } from './store.js';
import { createSupermarketsView } from './ui/supermarkets.js';
import { createShoppingListView } from './ui/cartView.js';
import { createSupermarketOffersView } from './ui/supermarketOffers.js';

const appRoot = document.getElementById('app');
const navLinks = Array.from(document.querySelectorAll('.nav-link'));
let legalText = 'Actualizamos semanalmente según disponibilidad pública de cada supermercado.';

const rateLimitWindow = 60 * 1000;
const rateLimitMax = 60;
const rateLimitLog = [];

if (window.fetch) {
  window.fetch = createRateLimitedFetch(window.fetch.bind(window));
}

init();

async function init() {
  await ensureSeedData();
  aplicarAjustes();
  await router();
  window.addEventListener('hashchange', router);
}

async function router() {
  const hash = window.location.hash.replace('#', '') || '/';
  const [path, ...parts] = hash.split('/').filter(Boolean);

  if (!path) {
    await renderHome();
    setActiveNav('/');
    return;
  }

  switch (path) {
    case 'supermercados': {
      await renderSupermercados();
      setActiveNav('/supermercados');
      break;
    }
    case 'lista': {
      await renderListaDeCompras();
      setActiveNav('/lista');
      break;
    }
    case 'supermercado': {
      const id = Number(parts[0]);
      if (Number.isFinite(id) && id > 0) {
        await renderSupermercadoDetalle(id);
      } else {
        await renderNotFound();
      }
      setActiveNav(null);
      break;
    }
    default:
      await renderNotFound();
      setActiveNav(null);
  }
}

function setActiveNav(route) {
  navLinks.forEach((link) => {
    const match = link.dataset.route === route;
    link.classList.toggle('is-active', match);
    if (match) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

async function renderHome() {
  const template = document.getElementById('home-template');
  const clone = template?.content?.cloneNode(true);
  if (!clone) return;
  const legal = clone.querySelector('.legal-highlight');
  if (legal) {
    legal.textContent = obtenerLeyendaLegal();
  }
  appRoot.textContent = '';
  appRoot.appendChild(clone);
}

async function renderSupermercados() {
  appRoot.textContent = '';
  const view = createSupermarketsView({
    onSelectSupermercado(supermercado) {
      window.location.hash = `#/supermercado/${supermercado.id}`;
    },
  });
  appRoot.appendChild(view);
}

async function renderListaDeCompras() {
  appRoot.textContent = '';
  const view = createShoppingListView();
  appRoot.appendChild(view);
}

async function renderSupermercadoDetalle(id) {
  appRoot.textContent = '';
  purgeVencidas();
  const view = createSupermarketOffersView({ supermercadoId: id, onBack: () => {
    window.location.hash = '#/supermercados';
  }});
  appRoot.appendChild(view);
}

async function renderNotFound() {
  appRoot.textContent = '';
  const section = document.createElement('section');
  section.className = 'section-card';
  const title = document.createElement('h2');
  title.textContent = 'No encontramos esa página';
  const action = document.createElement('a');
  action.className = 'button';
  action.href = '#/';
  action.textContent = 'Ir al inicio';
  section.append(title, action);
  appRoot.appendChild(section);
}

function aplicarAjustes() {
  const ajustes = getPreferences();
  if (ajustes['ajuste:legal']) {
    legalText = ajustes['ajuste:legal'];
  } else {
    legalText = 'Actualizamos semanalmente según disponibilidad pública de cada supermercado.';
  }
}

function obtenerLeyendaLegal() {
  return legalText;
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
