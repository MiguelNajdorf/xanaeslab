const API_BASE = 'https://anagramdev.com/apps/xanaeslab/querys/querys/';

function buildUrl(endpoint, params) {
  const url = new URL(endpoint, API_BASE);
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, value);
    });
  }
  return url.toString();
}

async function apiFetch(endpoint, { method = 'GET', params, body, headers = {}, raw = false } = {}) {
  const url = buildUrl(endpoint, params);
  const init = {
    method,
    headers: {
      'Accept': 'application/json',
      ...headers,
    },
    credentials: 'include',
  };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(url, init);
  if (!raw) {
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.error?.message || 'Error en la solicitud');
      error.status = response.status;
      error.details = data?.error?.details;
      throw error;
    }
    return data?.data ?? data;
  }
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || 'Error en la solicitud');
    error.status = response.status;
    throw error;
  }
  return response;
}

export async function login(email, password) {
  return apiFetch('login.php', { method: 'POST', body: { email, password } });
}

export async function logout() {
  return apiFetch('logout.php', { method: 'POST' });
}

export async function currentUser() {
  return apiFetch('me.php');
}

export async function supermarketsList(filters = {}) {
  return apiFetch('supermarkets_list.php', { params: filters });
}

export async function supermarketGet(id) {
  return apiFetch('supermarkets_get.php', { params: { id } });
}

export async function supermarketCreate(payload) {
  return apiFetch('supermarkets_create.php', { method: 'POST', body: payload });
}

export async function supermarketUpdate(id, payload) {
  return apiFetch('supermarkets_update.php', { method: 'PATCH', body: { id, ...payload } });
}

export async function supermarketDelete(id, { force = false } = {}) {
  return apiFetch('supermarkets_delete.php', { method: 'DELETE', body: { id, force } });
}

export async function storeHoursSet(supermarket_id, hours) {
  return apiFetch('store_hours_set.php', { method: 'POST', body: { supermarket_id, hours } });
}

export async function categoriesList(filters = {}) {
  return apiFetch('categories_list.php', { params: filters });
}

export async function categoryGet(id) {
  return apiFetch('categories_get.php', { params: { id } });
}

export async function categoryCreate(payload) {
  return apiFetch('categories_create.php', { method: 'POST', body: payload });
}

export async function categoryUpdate(id, payload) {
  return apiFetch('categories_update.php', { method: 'PATCH', body: { id, ...payload } });
}

export async function categoryDelete(id) {
  return apiFetch('categories_delete.php', { method: 'DELETE', body: { id } });
}

export async function productsList(filters = {}) {
  return apiFetch('products_list.php', { params: filters });
}

export async function productGet(id) {
  return apiFetch('products_get.php', { params: { id } });
}

export async function productCreate(payload) {
  return apiFetch('products_create.php', { method: 'POST', body: payload });
}

export async function productUpdate(id, payload) {
  return apiFetch('products_update.php', { method: 'PATCH', body: { id, ...payload } });
}

export async function productDelete(id) {
  return apiFetch('products_delete.php', { method: 'DELETE', body: { id } });
}

export async function productsBulkUpload(csvBase64) {
  return apiFetch('products_bulk_upload.php', { method: 'POST', body: { csv_base64: csvBase64 } });
}

export async function storeProductUpsert(payload) {
  return apiFetch('store_products_upsert.php', { method: 'POST', body: payload });
}

export async function storeProductGet(supermarket_id, product_id) {
  return apiFetch('store_products_get.php', { params: { supermarket_id, product_id } });
}

export async function storeProductsList(filters = {}) {
  return apiFetch('store_products_list.php', { params: filters });
}

export async function cartCreateOrGet(payload = {}) {
  return apiFetch('cart_create_or_get.php', { method: 'POST', body: payload });
}

export async function cartAddItem(payload) {
  return apiFetch('cart_add_item.php', { method: 'POST', body: payload });
}

export async function cartUpdateItem(payload) {
  return apiFetch('cart_update_item.php', { method: 'PATCH', body: payload });
}

export async function cartGet(filters) {
  return apiFetch('cart_get.php', { params: filters });
}

export async function cartFinalize(payload) {
  return apiFetch('cart_finalize.php', { method: 'POST', body: payload });
}

export async function compareBestBasket(payload) {
  return apiFetch('compare_best_basket.php', { method: 'POST', body: payload });
}

export const apiClient = {
  login,
  logout,
  currentUser,
  supermarketsList,
  supermarketGet,
  supermarketCreate,
  supermarketUpdate,
  supermarketDelete,
  storeHoursSet,
  categoriesList,
  categoryGet,
  categoryCreate,
  categoryUpdate,
  categoryDelete,
  productsList,
  productGet,
  productCreate,
  productUpdate,
  productDelete,
  productsBulkUpload,
  storeProductUpsert,
  storeProductGet,
  storeProductsList,
  cartCreateOrGet,
  cartAddItem,
  cartUpdateItem,
  cartGet,
  cartFinalize,
  compareBestBasket,
};

export default apiClient;
