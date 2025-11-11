import {
  cartCreateOrGet,
  cartGet,
  compareBestBasket,
} from '../apiClient.js';

const CART_TOKEN_KEY = 'xanaeslab:sessionToken';
let cartId = null;
let sessionToken = null;

document.addEventListener('DOMContentLoaded', async () => {
  const status = document.getElementById('compare-status');
  const cartTable = document.getElementById('cart-items');
  const mixTable = document.getElementById('mix-table');
  const singleTable = document.getElementById('single-table');
  const summaryList = document.getElementById('compare-summary');
  const refreshBtn = document.getElementById('refresh-compare');

  sessionToken = localStorage.getItem(CART_TOKEN_KEY) || null;

  try {
    const result = await cartCreateOrGet(sessionToken ? { session_token: sessionToken } : {});
    cartId = result.cart_id;
    sessionToken = result.session_token || sessionToken;
    if (sessionToken) {
      localStorage.setItem(CART_TOKEN_KEY, sessionToken);
    }
    status.textContent = `Carrito #${cartId}`;
    status.classList.add('success');
    await render();
  } catch (error) {
    status.textContent = error.message || 'No se pudo preparar el carrito';
    status.classList.add('error');
    refreshBtn.disabled = true;
  }

  refreshBtn?.addEventListener('click', () => {
    render();
  });

  async function render() {
    await renderCart();
    await renderComparison();
  }

  async function renderCart() {
    cartTable.innerHTML = '<tr><td colspan="2">Cargando…</td></tr>';
    try {
      const payload = cartId ? { cart_id: cartId } : { session_token: sessionToken };
      const data = await cartGet(payload);
      const items = data.items || [];
      if (!items.length) {
        cartTable.innerHTML = '<tr><td colspan="2">El carrito está vacío.</td></tr>';
        return;
      }
      cartTable.innerHTML = '';
      items.forEach((item) => {
        const tr = document.createElement('tr');
        const desc = `${item.name || ''} ${item.brand ? '(' + item.brand + ')' : ''}`.trim() || `Producto ${item.product_id}`;
        tr.innerHTML = `
          <td>${desc}</td>
          <td>${Number(item.quantity).toFixed(2)}</td>
        `;
        cartTable.appendChild(tr);
      });
    } catch (error) {
      cartTable.innerHTML = `<tr><td colspan="2">${error.message}</td></tr>`;
    }
  }

  async function renderComparison() {
    mixTable.innerHTML = '<tr><td colspan="4">Calculando…</td></tr>';
    singleTable.innerHTML = '<tr><td colspan="2">Calculando…</td></tr>';
    summaryList.textContent = '';
    try {
      const payload = cartId ? { cart_id: cartId } : { session_token: sessionToken };
      const data = await compareBestBasket(payload);
      const mix = data.mix_and_match;
      const single = data.single_store;
      const comparison = data.comparison;

      if (mix?.items?.length) {
        mixTable.innerHTML = '';
        mix.items.forEach((item) => {
          const tr = document.createElement('tr');
          const best = item.best_option;
          tr.innerHTML = `
            <td>${item.product?.name || 'Producto ' + item.product_id}</td>
            <td>${best ? best.supermarket_name : 'Sin stock'}</td>
            <td>${best ? best.price.toFixed(2) + ' ' + best.currency : '—'}</td>
            <td>${best?.updated_at ? new Date(best.updated_at).toLocaleString() : ''}</td>
          `;
          mixTable.appendChild(tr);
        });
      } else {
        mixTable.innerHTML = '<tr><td colspan="4">No hay datos de precios disponibles.</td></tr>';
      }

      if (single?.alternatives?.length) {
        singleTable.innerHTML = '';
        single.alternatives.forEach((alt) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${alt.supermarket_name}</td>
            <td>${alt.total.toFixed(2)} ${alt.currency || 'ARS'}</td>
          `;
          singleTable.appendChild(tr);
        });
      } else {
        singleTable.innerHTML = '<tr><td colspan="2">No hay supermercados que cubran toda la canasta.</td></tr>';
      }

      const summaryItems = [];
      if (typeof mix?.total === 'number') {
        summaryItems.push(`Total combinando mejores precios: ${mix.total.toFixed(2)} ARS`);
      }
      if (single?.best) {
        summaryItems.push(`Mejor supermercado único: ${single.best.supermarket_name} (${single.best.total.toFixed(2)} ${single.best.currency || 'ARS'})`);
      }
      if (typeof comparison?.savings_absolute === 'number') {
        const label = comparison.savings_absolute >= 0 ? 'Ahorro' : 'Diferencia';
        const percent = comparison.savings_percent !== null && comparison.savings_percent !== undefined
          ? `${comparison.savings_percent.toFixed(2)}%`
          : 'N/D';
        summaryItems.push(`${label}: ${comparison.savings_absolute.toFixed(2)} ARS (${percent})`);
      }
      if (mix?.unavailable_products?.length) {
        summaryItems.push(`Productos sin stock en los supermercados cargados: ${mix.unavailable_products.join(', ')}`);
      }

      if (!summaryItems.length) {
        summaryList.innerHTML = '<li>No hay información suficiente para generar el resumen.</li>';
      } else {
        summaryList.innerHTML = '';
        summaryItems.forEach((text) => {
          const li = document.createElement('li');
          li.textContent = text;
          summaryList.appendChild(li);
        });
      }
    } catch (error) {
      mixTable.innerHTML = `<tr><td colspan="4">${error.message}</td></tr>`;
      singleTable.innerHTML = `<tr><td colspan="2">${error.message}</td></tr>`;
      summaryList.innerHTML = '';
      const li = document.createElement('li');
      li.textContent = error.message || 'No se pudo calcular la comparación.';
      summaryList.appendChild(li);
    }
  }
});
