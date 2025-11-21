import {
  currentUser,
  supermarketsList,
  productsList,
  pricesList,
  priceCreate,
  priceUpdate,
  priceDelete,
  promoTypesList,
} from '../apiClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const pageStatus = document.getElementById('page-status');
  const priceForm = document.getElementById('price-form');
  const priceStatus = document.getElementById('price-status');
  const filtersForm = document.getElementById('price-filters');
  const priceTable = document.getElementById('price-table');
  const cancelEditBtn = document.getElementById('cancel-edit');

  let editingPriceId = null;

  const superSelects = document.querySelectorAll('select[name="supermarket_id"]');
  const productSelects = document.querySelectorAll('select[name="product_id"]');
  const promoSelects = document.querySelectorAll('select[name="promo_type_id"]');

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
  await populatePromoTypes();
  await loadPrices();

  priceForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(priceForm);
    const payload = Object.fromEntries(formData.entries());

    // Convert to proper types
    payload.supermarket_id = Number(payload.supermarket_id);
    payload.product_id = Number(payload.product_id);
    payload.price = Number(payload.price);
    payload.promo_type_id = payload.promo_type_id ? Number(payload.promo_type_id) : null;

    // Remove empty valid_to
    if (!payload.valid_to) {
      payload.valid_to = null;
    }

    priceStatus.textContent = editingPriceId ? 'Actualizando…' : 'Guardando…';
    priceStatus.className = 'status';

    try {
      if (editingPriceId) {
        await priceUpdate(editingPriceId, payload);
        priceStatus.textContent = 'Precio actualizado correctamente.';
      } else {
        await priceCreate(payload);
        priceStatus.textContent = 'Precio creado correctamente.';
      }
      priceStatus.classList.add('success');
      priceForm.reset();
      cancelEdit();
      await loadPrices(Object.fromEntries(new FormData(filtersForm).entries()));
    } catch (error) {
      priceStatus.textContent = error.message || 'No se pudo guardar el precio';
      priceStatus.classList.add('error');
    }
  });

  cancelEditBtn?.addEventListener('click', cancelEdit);

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
    const data = await productsList({ limit: 500 });
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

  async function populatePromoTypes() {
    const data = await promoTypesList({ is_active: 1 });
    const items = data.items || [];
    promoSelects.forEach((select) => {
      if (!select) return;
      select.querySelectorAll('option[data-dynamic="1"]').forEach((opt) => opt.remove());
      items.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        option.dataset.dynamic = '1';
        select.appendChild(option);
      });
    });
  }

  async function loadPrices(params = {}) {
    priceTable.innerHTML = '<tr><td colspan="8">Cargando…</td></tr>';
    try {
      const data = await pricesList(params);
      const items = data.items || data.results || [];
      if (!items.length) {
        priceTable.innerHTML = '<tr><td colspan="8">Sin resultados.</td></tr>';
        return;
      }
      priceTable.innerHTML = '';
      items.forEach((item) => {
        const tr = document.createElement('tr');
        const isActive = item.is_active ? '✓ Activo' : '✗ Expirado';
        const validTo = item.valid_to || 'Vigente';
        const promo = item.promo_type_name || '-';

        tr.innerHTML = `
          <td>${item.supermarket_name || item.supermarket_id}</td>
          <td>${item.product_name || item.product_id}</td>
          <td>$${Number(item.price).toFixed(2)}</td>
          <td>${item.valid_from}</td>
          <td>${validTo}</td>
          <td>${promo}</td>
          <td>${isActive}</td>
          <td>
            <button class="button" data-action="edit" data-id="${item.id}">Editar</button>
            <button class="button" data-action="delete" data-id="${item.id}">Eliminar</button>
          </td>
        `;
        priceTable.appendChild(tr);
      });

      // Add event listeners to action buttons
      priceTable.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', () => editPrice(btn.dataset.id));
      });
      priceTable.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', () => deletePrice(btn.dataset.id));
      });
    } catch (error) {
      priceTable.innerHTML = `<tr><td colspan="8">${error.message}</td></tr>`;
    }
  }

  async function editPrice(id) {
    try {
      const data = await pricesList({ limit: 1000 });
      const price = data.items.find(p => p.id === Number(id));

      if (!price) {
        alert('Precio no encontrado');
        return;
      }

      editingPriceId = price.id;
      priceForm.supermarket_id.value = price.supermarket_id;
      priceForm.product_id.value = price.product_id;
      priceForm.price.value = price.price;
      priceForm.currency.value = price.currency;
      priceForm.valid_from.value = price.valid_from;
      priceForm.valid_to.value = price.valid_to || '';
      priceForm.promo_type_id.value = price.promo_type_id || '';

      cancelEditBtn.style.display = 'inline-block';
      priceForm.querySelector('button[type="submit"]').textContent = 'Actualizar precio';
      priceStatus.textContent = 'Editando precio existente';
      priceStatus.className = 'status';
    } catch (error) {
      alert('Error al cargar precio: ' + error.message);
    }
  }

  async function deletePrice(id) {
    if (!confirm('¿Estás seguro de eliminar este precio?')) {
      return;
    }

    try {
      await priceDelete(Number(id));
      await loadPrices(Object.fromEntries(new FormData(filtersForm).entries()));
      priceStatus.textContent = 'Precio eliminado correctamente.';
      priceStatus.className = 'status success';
    } catch (error) {
      priceStatus.textContent = 'Error al eliminar: ' + error.message;
      priceStatus.className = 'status error';
    }
  }

  function cancelEdit() {
    editingPriceId = null;
    priceForm.reset();
    cancelEditBtn.style.display = 'none';
    priceForm.querySelector('button[type="submit"]').textContent = 'Guardar precio';
    priceStatus.textContent = '';
    priceStatus.className = 'status';
  }

  function disablePage() {
    priceForm?.querySelectorAll('input,select,button').forEach((el) => el.setAttribute('disabled', 'disabled'));
    filtersForm?.querySelectorAll('input,select,button').forEach((el) => el.setAttribute('disabled', 'disabled'));
  }
});
