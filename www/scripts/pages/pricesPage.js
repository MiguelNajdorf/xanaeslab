import {
  currentUser,
  supermarketsList,
  productsList,
  storeProductUpsert,
  storeProductsList,
} from '../apiClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const pageStatus = document.getElementById('page-status');
  const priceForm = document.getElementById('price-form');
  const priceStatus = document.getElementById('price-status');
  const filtersForm = document.getElementById('price-filters');
  const priceTable = document.getElementById('price-table');

  const superSelects = document.querySelectorAll('select[name="supermarket_id"]');
  const productSelects = document.querySelectorAll('select[name="product_id"]');

  try {
    const user = await currentUser();
    if (user?.role !== 'admin') {
      pageStatus.textContent = 'Acceso restringido. Iniciá sesión como admin.';
      pageStatus.classList.add('error');
      disablePage();
      return;
    }
    pageStatus.textContent = 'Sesión validada.';
    pageStatus.classList.add('success');
  } catch (error) {
    pageStatus.textContent = 'Sesión inválida.';
    pageStatus.classList.add('error');
    disablePage();
    return;
  }

  await populateSupermarkets();
  await populateProducts();
  await loadPrices();

  priceForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(priceForm);
    const payload = Object.fromEntries(formData.entries());
    payload.supermarket_id = Number(payload.supermarket_id);
    payload.product_id = Number(payload.product_id);
    payload.price = Number(payload.price);
    priceStatus.textContent = 'Guardando…';
    priceStatus.className = 'status';
    try {
      await storeProductUpsert(payload);
      priceStatus.textContent = 'Precio guardado correctamente.';
      priceStatus.classList.add('success');
      await loadPrices(Object.fromEntries(new FormData(filtersForm).entries()));
    } catch (error) {
      priceStatus.textContent = error.message || 'No se pudo guardar el precio';
      priceStatus.classList.add('error');
    }
  });

  filtersForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    loadPrices(Object.fromEntries(new FormData(filtersForm).entries()));
  });

  async function populateSupermarkets() {
    const data = await supermarketsList({ limit: 100, is_active: 1 });
    const items = data.items || data.results || [];
    superSelects.forEach((select) => {
      if (!select) return;
      const isMainSelect = select.closest('form') === priceForm;
      if (!Array.from(select.options).some((opt) => opt.value === '')) {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = isMainSelect ? 'Seleccioná' : 'Todos';
        select.appendChild(placeholder);
      }
      select.querySelectorAll('option[data-dynamic="1"]').forEach((opt) => opt.remove());
      items.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.name} (${item.city || ''})`;
        option.dataset.dynamic = '1';
        select.appendChild(option);
      });
    });
  }

  async function populateProducts() {
    const data = await productsList({ limit: 100 });
    const items = data.items || data.results || [];
    productSelects.forEach((select) => {
      if (!select) return;
      const isMainSelect = select.closest('form') === priceForm;
      if (!Array.from(select.options).some((opt) => opt.value === '')) {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = isMainSelect ? 'Seleccioná' : 'Todos';
        select.appendChild(placeholder);
      }
      select.querySelectorAll('option[data-dynamic="1"]').forEach((opt) => opt.remove());
      items.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.id;
        // Show "Product - Brand - Size" format
        const brandName = item.brand_name || item.brand || '';
        const size = item.size || '';
        let displayText = item.name;
        if (brandName) displayText += ` - ${brandName}`;
        if (size) displayText += ` - ${size}`;
        option.textContent = displayText;
        option.dataset.dynamic = '1';
        select.appendChild(option);
      });
    });
  }

  async function loadPrices(params = {}) {
    priceTable.innerHTML = '<tr><td colspan="6">Cargando…</td></tr>';
    try {
      const data = await storeProductsList(params);
      const items = data.items || data.results || [];
      if (!items.length) {
        priceTable.innerHTML = '<tr><td colspan="6">Sin resultados.</td></tr>';
        return;
      }
      priceTable.innerHTML = '';
      items.forEach((item) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${item.supermarket?.name || item.supermarket_name || item.supermarket_id}</td>
          <td>${item.product?.name || item.product_name || item.product_id}</td>
          <td>${Number(item.price).toFixed(2)}</td>
          <td>${item.currency}</td>
          <td>${item.stock_status}</td>
          <td>${item.updated_at ? new Date(item.updated_at).toLocaleString() : ''}</td>
        `;
        priceTable.appendChild(tr);
      });
    } catch (error) {
      priceTable.innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`;
    }
  }

  function disablePage() {
    priceForm?.querySelectorAll('input,select,button').forEach((el) => el.setAttribute('disabled', 'disabled'));
    filtersForm?.querySelectorAll('input,select,button').forEach((el) => el.setAttribute('disabled', 'disabled'));
  }
});
