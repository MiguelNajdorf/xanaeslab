export function renderMapList(container, supermarkets) {
  container.innerHTML = '';
  if (!supermarkets.length) {
    container.innerHTML = '<p>No hay supermercados cargados.</p>';
    return;
  }
  for (const supermarket of supermarkets) {
    const card = document.createElement('article');
    card.className = 'list-item';
    card.innerHTML = `
      <header>
        <strong>${supermarket.nombre}</strong>
        <a class="badge badge-promo" href="${supermarket.mapsUrl}" target="_blank" rel="noopener">Abrir en Maps</a>
      </header>
      <p>${supermarket.direccion}</p>
      <small>${supermarket.ciudad}</small>
      <small>${supermarket.telefono || 'Sin teléfono'}</small>
    `;
    container.append(card);
  }
}
