import { ensureSeedData, getPreferences, purgeVencidas } from './store.js';
import { createSupermarketsView } from './ui/supermarkets.js';
import { createShoppingListView } from './ui/cartView.js';
import { createSupermarketOffersView } from './ui/supermarketOffers.js';

const appRoot = document.getElementById('app');
const navLinks = Array.from(document.querySelectorAll('.nav-link'));
const sideMenuLinks = Array.from(document.querySelectorAll('.side-menu-link'));
const menuToggle = document.querySelector('.menu-toggle');
const sideMenu = document.getElementById('sideMenu');
const sideMenuOverlay = document.getElementById('sideMenuOverlay');
let legalText = 'Información obtenida de fuentes públicas. Xanaes Lab no se responsabiliza por cambios o diferencias en los datos mostrados.';

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
  
  // Inicializar menú lateral
  initializeSideMenu();
}

function initializeSideMenu() {
  if (menuToggle) {
    menuToggle.addEventListener('click', toggleSideMenu);
  }
  
  if (sideMenuOverlay) {
    sideMenuOverlay.addEventListener('click', closeSideMenu);
  }
  
  if (sideMenu) {
    const closeBtn = sideMenu.querySelector('.side-menu-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeSideMenu);
    }
  }
  
  // Cerrar menú al cambiar de ruta
  window.addEventListener('hashchange', closeSideMenu);
}

function toggleSideMenu() {
  const isOpen = sideMenu?.classList.contains('open');
  
  if (isOpen) {
    closeSideMenu();
  } else {
    openSideMenu();
  }
}

function openSideMenu() {
  if (menuToggle) menuToggle.classList.add('active');
  if (menuToggle) menuToggle.setAttribute('aria-expanded', 'true');
  if (sideMenu) sideMenu.classList.add('open');
  if (sideMenuOverlay) sideMenuOverlay.classList.add('active');
  if (sideMenuOverlay) sideMenuOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeSideMenu() {
  if (menuToggle) menuToggle.classList.remove('active');
  if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
  if (sideMenu) sideMenu.classList.remove('open');
  if (sideMenuOverlay) sideMenuOverlay.classList.remove('active');
  if (sideMenuOverlay) sideMenuOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
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
    case 'farmacias': {
      await renderFarmacias();
      setActiveNav('/farmacias');
      break;
    }
    case 'basura': {
      await renderBasura();
      setActiveNav('/basura');
      break;
    }
    case 'menu': {
      await renderMenu();
      setActiveNav('/menu');
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
  // Header navigation
  navLinks.forEach((link) => {
    const match = link.dataset.route === route;
    link.classList.toggle('is-active', match);
    if (match) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  
  // Side menu navigation
  if (sideMenuLinks) {
    sideMenuLinks.forEach((link) => {
      const match = link.dataset.route === route;
      link.classList.toggle('active', match);
      if (match) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }
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
  try {
    console.log('Renderizando detalle de supermercado:', id);
    appRoot.textContent = '';
    purgeVencidas();
    const view = createSupermarketOffersView({ supermercadoId: id, onBack: () => {
      window.location.hash = '#/supermercados';
    }});
    appRoot.appendChild(view);
    console.log('Vista de supermercado agregada correctamente');
  } catch (error) {
    console.error('Error al renderizar detalle de supermercado:', error);
    appRoot.textContent = '';
    const section = document.createElement('section');
    section.className = 'section-card';
    const title = document.createElement('h2');
    title.textContent = 'Error al cargar las ofertas';
    const message = document.createElement('p');
    message.textContent = `No pudimos cargar las ofertas del supermercado. Error: ${error.message}`;
    section.appendChild(title);
    section.appendChild(message);
    appRoot.appendChild(section);
  }
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
    legalText = 'Información obtenida de fuentes públicas. Xanaes Lab no se responsabiliza por cambios o diferencias en los datos mostrados.';
  }
}

async function renderFarmacias() {
  appRoot.textContent = '';
  const section = document.createElement('section');
  section.className = 'section-card';
  
  const title = document.createElement('h2');
  title.textContent = 'Farmacias de turno';
  
  const content = document.createElement('div');
  content.innerHTML = `
    <p>Información sobre farmacias de turno en Río Segundo y Pilar.</p>
    <p>Próximamente podrás ver aquí las farmacias actualmente de turno.</p>
  `;
  
  section.appendChild(title);
  section.appendChild(content);
  appRoot.appendChild(section);
}

async function renderBasura() {
  appRoot.textContent = '';
  const section = document.createElement('section');
  section.className = 'section-card';
  
  const title = document.createElement('h2');
  title.textContent = 'Recolección de basura';
  
  const content = document.createElement('div');
  content.innerHTML = `
    <p>Calendario de recolección de basura por barrio en Río Segundo y Pilar.</p>
    <p>Próximamente podrás ver aquí los días de recolección para tu barrio.</p>
  `;
  
  section.appendChild(title);
  section.appendChild(content);
  appRoot.appendChild(section);
}

async function renderMenu() {
  appRoot.textContent = '';
  const section = document.createElement('section');
  section.className = 'section-card';
  
  const title = document.createElement('h2');
  title.textContent = 'Todas las opciones';
  
  const grid = document.createElement('div');
  grid.className = 'options-grid';
  
  const options = [
    { title: 'Ofertas de Supermercados', desc: 'Ver supermercados disponibles', icon: '🛒', href: '#/supermercados' },
    { title: 'Farmacias', desc: 'Farmacias de turno', icon: '💊', href: '#/farmacias' },
    { title: 'Basura', desc: 'Recolección por barrio', icon: '🗑️', href: '#/basura' },
    { title: 'Lista de compras', desc: 'Gestionar tu lista', icon: '📋', href: '#/lista' },
  ];
  
  options.forEach(option => {
    const card = document.createElement('div');
    card.className = 'option-card';
    card.innerHTML = `
      <div class="option-icon">${option.icon}</div>
      <h3>${option.title}</h3>
      <p>${option.desc}</p>
      <a href="${option.href}" class="option-link">Ver más</a>
    `;
    grid.appendChild(card);
  });
  
  section.appendChild(title);
  section.appendChild(grid);
  appRoot.appendChild(section);
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
