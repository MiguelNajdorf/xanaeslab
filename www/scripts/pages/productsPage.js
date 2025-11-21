import {
  currentUser,
  productsList,
  productCreate,
  productUpdate,
  productDelete,
  productsBulkUpload,
  brandsList,
  categoriesList,
} from '../apiClient.js';

const table = document.getElementById('products-table');
const searchForm = document.getElementById('search-form');
const resetBtn = document.getElementById('reset-search');
const productForm = document.getElementById('product-form');
const productStatus = document.getElementById('product-status');
const deleteBtn = document.getElementById('delete-product');
const pageStatus = document.getElementById('page-status');
const bulkForm = document.getElementById('bulk-form');
const bulkStatus = document.getElementById('bulk-status');

let selected = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const user = await currentUser();
    if (user?.role !== 'admin') {
      pageStatus.textContent = 'Acceso denegado. Iniciá sesión como admin.';
      pageStatus.classList.add('error');
      disablePage();
      return;
    }
    pageStatus.textContent = 'Sesión validada.';
    pageStatus.classList.add('success');
  } catch (error) {
    pageStatus.textContent = 'Sesión no disponible.';
    pageStatus.classList.add('error');
    disablePage();
    return;
  }

  // Load categories for selects
  try {
    const categoriesData = await categoriesList({ limit: 500 });
    const categories = categoriesData.items || categoriesData.results || [];
    console.log('Categories loaded:', categories.length, categories);

    if (categories.length === 0) {
      console.warn('No categories found in database');
      pageStatus.textContent = 'Advertencia: No hay categorías en la base de datos.';
      pageStatus.classList.add('error');
    }

    const categorySelects = document.querySelectorAll('select[name="category_id"]');
    console.log('Category selects found:', categorySelects.length);

    categorySelects.forEach(select => {
      categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        select.appendChild(option);
      });
    });
  } catch (e) {
    console.error('Error loading categories', e);
    pageStatus.textContent = 'Error cargando categorías: ' + e.message;
    pageStatus.classList.add('error');
  }

  // Load brands for select
  try {
    const brandsData = await brandsList({ limit: 500 });
    const brands = brandsData.items || brandsData.results || [];
    const brandSelect = productForm.elements['brand_id'];
    brands.forEach(brand => {
      const option = document.createElement('option');
      option.value = brand.id;
      option.textContent = brand.name;
      brandSelect.appendChild(option);
    });
  } catch (e) {
    console.error('Error loading brands', e);
  }

  searchForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    loadProducts(Object.fromEntries(new FormData(searchForm).entries()));
  });

  resetBtn?.addEventListener('click', () => {
    searchForm.reset();
    loadProducts();
  });

  productForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(productForm);
    const payload = Object.fromEntries(formData.entries());
    payload.category_id = Number(payload.category_id);
    if (payload.brand_id) payload.brand_id = Number(payload.brand_id);
    else payload.brand_id = null;

    productStatus.textContent = 'Guardando…';
    productStatus.className = 'status';
    try {
      if (payload.id) {
        await productUpdate(Number(payload.id), payload);
        productStatus.textContent = 'Producto actualizado.';
      } else {
        await productCreate(payload);
        productStatus.textContent = 'Producto creado.';
      }
      productStatus.classList.add('success');
      productForm.reset();
      selected = null;
      await loadProducts(Object.fromEntries(new FormData(searchForm).entries()));
    } catch (error) {
      productStatus.textContent = error.message || 'No se pudo guardar';
      productStatus.classList.add('error');
    }
  });

  deleteBtn?.addEventListener('click', async () => {
    if (!selected?.id) {
      productStatus.textContent = 'Seleccioná un producto primero.';
      productStatus.classList.add('error');
      return;
    }
    if (!window.confirm('¿Eliminar este producto?')) return;
    productStatus.textContent = 'Eliminando…';
    productStatus.className = 'status';
    try {
      await productDelete(selected.id);
      productStatus.textContent = 'Producto eliminado.';
      productStatus.classList.add('success');
      productForm.reset();
      selected = null;
      await loadProducts(Object.fromEntries(new FormData(searchForm).entries()));
    } catch (error) {
      productStatus.textContent = error.message || 'No se pudo eliminar';
      productStatus.classList.add('error');
    }
  });

  bulkForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fileInput = bulkForm.querySelector('input[type="file"]');
    if (!fileInput?.files?.length) {
      bulkStatus.textContent = 'Seleccioná un archivo CSV.';
      bulkStatus.classList.add('error');
      return;
    }
    bulkStatus.textContent = 'Procesando archivo…';
    bulkStatus.className = 'status';
    const file = fileInput.files[0];
    try {
      const csvBase64 = await readFileAsBase64(file);
      const result = await productsBulkUpload(csvBase64);
      bulkStatus.textContent = `Carga completa. Importados: ${result?.imported ?? 0}, duplicados: ${result?.duplicates ?? 0}`;
      bulkStatus.classList.add('success');
      await loadProducts(Object.fromEntries(new FormData(searchForm).entries()));
    } catch (error) {
      bulkStatus.textContent = error.message || 'No se pudo subir el CSV';
      bulkStatus.classList.add('error');
    }
  });

  loadProducts();
});

async function loadProducts(params = {}) {
  table.innerHTML = '<tr><td colspan="7">Cargando…</td></tr>';
  try {
    const response = await productsList(params);
    const items = response.items || response.results || [];
    if (!items.length) {
      table.innerHTML = '<tr><td colspan="7">Sin resultados.</td></tr>';
      return;
    }
    table.innerHTML = '';
    items.forEach((item) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.id}</td>
        <td>${item.name}</td>
        <td>${item.brand_name || item.brand || ''}</td>
        <td>${item.category?.name || item.category_name || item.category_id}</td>
        <td>${item.unit}</td>
        <td>${item.size || ''}</td>
        <td><button type="button" class="button ghost" data-id="${item.id}">Editar</button></td>
      `;
      tr.querySelector('button').addEventListener('click', () => select(item));
      table.appendChild(tr);
    });
  } catch (error) {
    table.innerHTML = `<tr><td colspan="7">${error.message}</td></tr>`;
  }
}

function select(item) {
  selected = item;
  productForm.elements['id'].value = item.id;
  productForm.elements['name'].value = item.name || '';
  productForm.elements['brand_id'].value = item.brand_id || '';
  productForm.elements['category_id'].value = item.category_id || item.category?.id || '';
  productForm.elements['unit'].value = item.unit || '';
  productForm.elements['size'].value = item.size || '';
  productForm.elements['barcode'].value = item.barcode || '';
  productStatus.textContent = `Editando producto #${item.id}`;
  productStatus.className = 'status';
}

function disablePage() {
  searchForm?.querySelectorAll('input,button').forEach((el) => el.setAttribute('disabled', 'disabled'));
  productForm?.querySelectorAll('input,button,select').forEach((el) => el.setAttribute('disabled', 'disabled'));
  bulkForm?.querySelectorAll('input,button').forEach((el) => el.setAttribute('disabled', 'disabled'));
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result.split(',')[1];
      resolve(result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
