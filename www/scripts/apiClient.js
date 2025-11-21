const API_BASE = 'https://anagramdev.com/apps/xanaeslab/querys/';

const ACCESS_TOKEN_KEY = 'xanaeslab.accessToken';
const REFRESH_TOKEN_KEY = 'xanaeslab.refreshToken';

function getStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

function storageGet(key) {
  const store = getStorage();
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch (error) {
    return null;
  }
}

function storageSet(key, value) {
  const store = getStorage();
  if (!store) return;
  try {
    store.setItem(key, value);
  } catch (error) {
    // ignorar almacenamiento no disponible
  }
}

function storageRemove(key) {
  const store = getStorage();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch (error) {
    // ignorar almacenamiento no disponible
  }
}

function saveTokens(accessToken, refreshToken) {
  if (accessToken) {
    storageSet(ACCESS_TOKEN_KEY, accessToken);
  } else {
    storageRemove(ACCESS_TOKEN_KEY);
  }

  if (refreshToken) {
    storageSet(REFRESH_TOKEN_KEY, refreshToken);
  } else if (refreshToken !== undefined) {
    storageRemove(REFRESH_TOKEN_KEY);
  }
}

function clearTokens() {
  storageRemove(ACCESS_TOKEN_KEY);
  storageRemove(REFRESH_TOKEN_KEY);
}

function getAccessToken() {
  return storageGet(ACCESS_TOKEN_KEY);
}

function getRefreshToken() {
  return storageGet(REFRESH_TOKEN_KEY);
}

function persistTokensFromResponse(data) {

  if (!data || typeof data !== 'object') {
    return;
  }

  if (data.accessToken || data.refreshToken) {


    saveTokens(data.accessToken || null, data.refreshToken || null);
  } else {
  }
}

let refreshPromise = null;

async function requestTokenRefresh() {

  // Si ya hay una petición de refresh en curso, la devuelve
  if (refreshPromise) {
    return refreshPromise;
  }


  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      const error = new Error('Sesión expirada. Iniciá sesión nuevamente.');
      error.status = 401;
      throw error;
    }

    const data = await apiFetch('refresh.php', {
      method: 'POST',
      body: { refreshToken },
      skipAuth: true,
      disableAutoRefresh: true,
    });

    persistTokensFromResponse(data); // Llama a la función de arriba para que la debuguee
    return data;
  })();

  // Limpia la promesa cuando termina (ya sea con éxito o error)
  refreshPromise.finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

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

async function apiFetch(endpoint, options = {}) {

  const {
    method = 'GET',
    params,
    body,
    headers = {},
    raw = false,
    skipAuth = false,
    disableAutoRefresh = false,
    _retry = false,
  } = options;

  const url = buildUrl(endpoint, params);

  // --- FUNCIÓN INTERNA PARA HACER LA PETICIÓN ---
  const makeRequest = async (requestType = 'Inicial') => {

    const initHeaders = {
      Accept: 'application/json',
      ...headers,
    };

    let tokenToUse = null;
    if (!skipAuth) {
      tokenToUse = getAccessToken();

      if (tokenToUse) {
        initHeaders['X-Authorization'] = `Bearer ${tokenToUse}`;
      }
    } else {
      console.log(` OMITIENDO autenticación`);
    }

    const init = {
      method,
      headers: initHeaders,
    };

    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    return fetch(url, init);
  };
  // --- FIN DE LA FUNCIÓN INTERNA ---

  let response = await makeRequest('inicial');


  // --- LÓGICA DE REINTENTO ---
  if (
    response.status === 401 &&
    !skipAuth &&
    !disableAutoRefresh &&
    !_retry &&
    getRefreshToken()
  ) {
    try {
      await requestTokenRefresh();
      response = await makeRequest('reintento');
    } catch (error) {
      console.error('--- ERROR EN EL REFRESH. LIMPIANDO TOKENS ---');
      clearTokens();
      throw error;
    }
  }

  // --- PROCESAMIENTO DE LA RESPUESTA FINAL ---
  if (raw) {
    if (!response.ok) {
      const text = await response.text();
      const error = new Error(text || 'Error en la solicitud');
      error.status = response.status;
      throw error;
    }
    return response;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error?.message || 'Error en la solicitud';
    console.error('API Error:', response.status, errorMsg, data?.error?.details || data);
    const error = new Error(errorMsg);
    error.status = response.status;
    error.details = data?.error?.details;
    throw error;
  }

  return data?.data ?? data;
}

export async function login(email, password) {
  const result = await apiFetch('login.php', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
    disableAutoRefresh: true,
  });
  persistTokensFromResponse(result);
  return result;
}

export async function logout() {
  const refreshToken = getRefreshToken();
  try {
    await apiFetch('logout.php', {
      method: 'POST',
      body: refreshToken ? { refreshToken } : {},
      disableAutoRefresh: true,
    });
  } finally {
    clearTokens();
  }
}

export async function currentUser() {
  const token = getAccessToken();
  if (!token) {
    return null;
  }
  try {
    return await apiFetch('me.php');
  } catch (error) {
    if (error?.status === 401) {
      clearTokens();
      return null;
    }
    throw error;
  }
}

export async function citiesList(filters = {}) {
  return apiFetch('cities_list.php', { params: filters });
}

export async function supermarketsList(filters = {}) {
  return apiFetch('https://anagramdev.com/apps/xanaeslab/querys/supermarkets_list.php', { params: filters });
}

export async function supermarketGet(id) {
  return apiFetch('supermarkets_get.php', { params: { id } });
}

export async function supermarketCreate(payload) {
  return apiFetch('supermarkets_create.php', { method: 'POST', body: payload });
}

export async function supermarketUpdate(id, payload) {
  return apiFetch('supermarkets_update.php', { method: 'PATCH', params: { id }, body: payload });
}

export async function supermarketDelete(id, { force = false } = {}) {
  return apiFetch('supermarkets_delete.php', { method: 'DELETE', params: { id }, body: { force } });
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

export async function brandsList(filters = {}) {
  return apiFetch('brands_list.php', { params: filters });
}

export async function brandGet(id) {
  return apiFetch('brands_get.php', { params: { id } });
}

export async function brandCreate(payload) {
  return apiFetch('brands_create.php', { method: 'POST', body: payload });
}

export async function brandUpdate(id, payload) {
  return apiFetch('brands_update.php', { method: 'PATCH', params: { id }, body: payload });
}

export async function brandDelete(id) {
  return apiFetch('brands_delete.php', { method: 'DELETE', body: { id } });
}

export async function neighborhoodsList(filters = {}) {
  return apiFetch('neighborhoods_list.php', { params: filters });
}

export async function neighborhoodUpdate(id, payload) {
  return apiFetch('neighborhoods_update.php', { method: 'PUT', body: { id, ...payload } });
}

export async function neighborhoodDelete(id) {
  return apiFetch('neighborhoods_delete.php', { method: 'DELETE', body: { id } });
}

export async function schedulesList(neighborhoodId) {
  return apiFetch('schedules_list.php', { params: { neighborhood_id: neighborhoodId } });
}

export async function scheduleCreate(payload) {
  return apiFetch('schedules_create.php', { method: 'POST', body: payload });
}

export async function scheduleDelete(id) {
  return apiFetch('schedules_delete.php', { method: 'DELETE', body: { id } });
}

// Pharmacy Catalog (permanent pharmacy data)
export async function pharmacyCatalogList(params = {}) {
  return apiFetch('pharmacies_catalog_list.php', { params });
}

export async function pharmacyCatalogCreate(payload) {
  return apiFetch('pharmacies_catalog_create.php', { method: 'POST', body: payload });
}

export async function pharmacyCatalogUpdate(id, payload) {
  return apiFetch('pharmacies_catalog_update.php', { method: 'PUT', body: { id, ...payload } });
}

export async function pharmacyCatalogDelete(id) {
  return apiFetch('pharmacies_catalog_delete.php', { method: 'DELETE', body: { id } });
}

// Pharmacy Duties (schedule assignments)
export async function pharmaciesList(params = {}) {
  return apiFetch('pharmacies_list.php', { params });
}

export async function pharmacyCreate(payload) {
  return apiFetch('pharmacies_create.php', { method: 'POST', body: payload });
}

export async function pharmacyUpdate(id, payload) {
  return apiFetch('pharmacies_update.php', { method: 'PUT', body: { id, ...payload } });
}

export async function pharmacyDelete(id) {
  return apiFetch('pharmacies_delete.php', { method: 'DELETE', body: { id } });
}
export async function pharmacyBulkCreate(payload) {
  return apiFetch('pharmacies_bulk_create.php', { method: 'POST', body: payload });
}

export async function pharmacyGetByDate(city, date = null) {
  const params = { city };
  if (date) params.date = date;
  return apiFetch('pharmacies_get_by_date.php', { params });
}

export async function pharmacyGetMonth(city, year, month) {
  return apiFetch('pharmacies_get_month.php', { params: { city, year, month } });
}

export async function categoryCreate(payload) {
  return apiFetch('categories_create.php', { method: 'POST', body: payload });
}

export async function categoryUpdate(id, payload) {
  return apiFetch('categories_update.php', { method: 'PATCH', params: { id }, body: payload });
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
  return apiFetch('products_update.php', { method: 'PATCH', params: { id }, body: payload });
}

export async function productDelete(id) {
  return apiFetch('products_delete.php', { method: 'DELETE', body: { id } });
}

export async function productsBulkUpload(csvBase64) {
  return apiFetch('products_bulk_upload.php', { method: 'POST', body: { csv_base64: csvBase64 } });
}

// Prices (replaces store_products)
export async function pricesList(filters = {}) {
  return apiFetch('prices_list.php', { params: filters });
}

export async function priceGet(id) {
  return apiFetch('prices_get.php', { params: { id } });
}

export async function priceCreate(payload) {
  return apiFetch('prices_create.php', { method: 'POST', body: payload });
}

export async function priceUpdate(id, payload) {
  return apiFetch('prices_update.php', { method: 'PUT', params: { id }, body: payload });
}

export async function priceDelete(id) {
  return apiFetch('prices_delete.php', { method: 'DELETE', body: { id } });
}

export async function promoTypesList(filters = {}) {
  return apiFetch('promo_types_list.php', { params: filters });
}

// --- OFFERS (LLM) ---

export async function offersUpload(formData) {
  // Note: When sending FormData, we don't set Content-Type header manually,
  // browser does it with boundary. apiFetch handles this if body is FormData?
  // Our apiFetch might need adjustment or we just pass it.
  // Let's check apiFetch implementation.
  // It uses JSON.stringify if body is object. We need to handle FormData.

  const token = getAccessToken();
  const headers = token ? { 'X-Authorization': `Bearer ${token}` } : {};

  const response = await fetch(buildUrl('offers_upload.php'), {
    method: 'POST',
    headers: headers,
    body: formData
  });

  return handleResponse(response);
}

export async function offersList(filters = {}) {
  return apiFetch('offers_list.php', { params: filters });
}

export async function offerGet(id) {
  return apiFetch('offers_get.php', { params: { id } });
}

export async function offerProcess(id) {
  // Trigger processing manually (for testing)
  // In production this is done by worker
  return apiFetch('offers_process.php', { method: 'POST', body: { id } });
}

export async function offerUpdateStatus(id, status) {
  return apiFetch('offers_confirm.php', { method: 'POST', body: { id, status } });
}

export async function offerDelete(id) {
  return apiFetch('offers_delete.php', { method: 'POST', body: { id } });
}

// Helper to handle fetch response consistent with apiFetch
async function handleResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { message: text };
  }

  if (!response.ok) {
    const error = new Error(data.message || 'Error en la petición');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

// Legacy store_products functions (deprecated - use prices instead)
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
  citiesList,
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
