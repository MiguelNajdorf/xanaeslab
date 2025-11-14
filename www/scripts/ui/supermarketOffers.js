import { agregarAListaDeCompras } from '../cart.js';
import { fetchPublicSupermarkets, fetchOffersForSupermarket, fetchBestPrices, getPublicSupermarketById, computeEffectiveUnitPrice } from '../store.js';
import { formatCurrency } from '../format.js';

export function createSupermarketOffersView({ supermercadoId, onBack }) {
  const container = document.createElement('section');
  container.className = 'section-card supermarket-offers-view';

  const header = document.createElement('div');
  header.className = 'supermarket-offers-header';
  container.appendChild(header);

  if (onBack) {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'button-tertiary';
    back.textContent = 'Volver a supermercados';
    back.addEventListener('click', onBack);
    header.appendChild(back);
  }

  const title = document.createElement('h2');
  title.textContent = 'Ofertas vigentes';
  header.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.className = 'muted';
  header.appendChild(subtitle);

  const liveRegion = document.createElement('div');
  liveRegion.className = 'sr-only';
  liveRegion.setAttribute('aria-live', 'polite');
  container.appendChild(liveRegion);

  const list = document.createElement('div');
  list.className = 'offers-grid';
  container.appendChild(list);

  render();

  async function render() {
    list.textContent = '';
    const loading = document.createElement('p');
    loading.className = 'muted';
    loading.textContent = 'Cargando ofertas…';
    list.appendChild(loading);

    await fetchPublicSupermarkets();
    const info = getPublicSupermarketById(supermercadoId);
    if (info) {
      title.textContent = `Ofertas en ${info.nombre}`;
      subtitle.textContent = `${info.nombre} - ${info.direccion || ''} - ${info.ciudad || ''}`;
    } else {
      subtitle.textContent = '';
    }

    try {
      const ofertas = await fetchOffersForSupermarket(supermercadoId);
      const ahora = new Date();
      const vigentes = ofertas.filter(oferta => !oferta.vigencia_hasta || new Date(oferta.vigencia_hasta) >= ahora);
      list.textContent = '';
      if (!vigentes.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'No hay ofertas vigentes para este supermercado.';
        list.appendChild(empty);
        return;
      }

      const ordenadas = vigentes.slice().sort((a, b) => ordenarOfertas(a, b));
      const bestPrices = await fetchBestPrices(ordenadas.map(oferta => oferta.producto_id));

      ordenadas.forEach((oferta) => {
        list.appendChild(renderOffer(oferta, bestPrices));
      });
    } catch (error) {
      console.error('No se pudieron cargar las ofertas', error);
      list.textContent = '';
      const failure = document.createElement('p');
      failure.className = 'muted';
      failure.textContent = 'No pudimos obtener las ofertas de este supermercado. Intentá nuevamente más tarde.';
      list.appendChild(failure);
    }
  }

  function renderOffer(oferta, bestPrices) {
    const card = document.createElement('article');
    card.className = 'offer-card';

    if (oferta.imagen_url) {
      const picture = document.createElement('img');
      picture.loading = 'lazy';
      picture.src = oferta.imagen_url;
      picture.alt = `${oferta.producto} ${oferta.presentacion}`.trim();
      card.appendChild(picture);
    }

    const heading = document.createElement('h3');
    heading.textContent = oferta.producto || 'Producto';
    card.appendChild(heading);

    const presentation = document.createElement('p');
    presentation.className = 'muted';
    presentation.textContent = oferta.presentacion || '';
    card.appendChild(presentation);

    const price = document.createElement('p');
    price.className = 'offer-price';
    price.textContent = formatCurrency(oferta.precio_individual);
    card.appendChild(price);

    if (oferta.precio_por_base) {
      const unit = document.createElement('p');
      unit.className = 'muted';
      const unitPrice = computeEffectiveUnitPrice(oferta, false) ?? oferta.precio_por_base;
      if (unitPrice) {
        const unidad = oferta.unidad_base ? ` / ${oferta.unidad_base}` : '';
        unit.textContent = `${formatCurrency(unitPrice)}${unidad}`;
        card.appendChild(unit);
      }
    }

    const status = document.createElement('p');
    status.className = 'offer-status';
    status.textContent = resolverMensajeEstado(oferta, bestPrices.get(oferta.producto_id));
    card.appendChild(status);

    const actions = document.createElement('div');
    actions.className = 'offer-actions';

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'button';
    addButton.textContent = '+ Agregar a la lista de compras';
    addButton.addEventListener('click', () => {
      agregarAListaDeCompras({
        producto_id: oferta.producto_id,
        cantidad: 1,
        descripcion: `${oferta.producto} ${oferta.presentacion}`.trim(),
      });
      mostrarFeedback(`${oferta.producto} sumado a tu lista de compras`);
    });
    actions.appendChild(addButton);

    card.appendChild(actions);
    return card;
  }

  function mostrarFeedback(mensaje) {
    liveRegion.textContent = mensaje;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = mensaje;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('is-hidden');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  return container;
}

function ordenarOfertas(a, b) {
  const precioBaseA = a.precio_por_base ?? a.precio_individual ?? 0;
  const precioBaseB = b.precio_por_base ?? b.precio_individual ?? 0;
  if (precioBaseA !== precioBaseB) {
    return precioBaseA - precioBaseB;
  }
  const nombreA = `${a.producto} ${a.marca}`.toLowerCase();
  const nombreB = `${b.producto} ${b.marca}`.toLowerCase();
  return nombreA.localeCompare(nombreB, 'es');
}

function resolverMensajeEstado(oferta, bestInfo) {
  if (!bestInfo || bestInfo.unico) {
    return 'Es el único precio publicado';
  }
  const precio = oferta.precio_individual ?? 0;
  const diff = Math.abs(precio - (bestInfo.mejor_precio ?? 0));
  if (diff < 0.0001) {
    return 'Es el mejor precio';
  }
  const nombre = bestInfo.mejor_supermercado || 'Otro supermercado';
  return `${nombre} tiene mejor precio`;
}
