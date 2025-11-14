import { parseNumber, parseDate, formatPresentation, promoMinimumQuantity } from './format.js';
import { citiesList, supermarketsList, categoriesList, productsList } from './apiClient.js';

const DB_NAME = 'xanaeslab';
const DB_VERSION = 1;
const CITY_KEY = 'xanaeslab:city';
const CART_KEY = 'xanaeslab:lista';
const PREFERENCES_KEY = 'xanaeslab:prefs';

const caches = {
  supermercados: new Map(),
  supermercadosRemotos: new Map(),
  productos: new Map(),
  ofertas: [],
  importaciones: [],
  ajustes: new Map(),
  ciudades: new Map(),
  ciudadesPorNombre: new Map(),
  ciudadesPorSlug: new Map(),
  categorias: new Map(),
  categoriasPorSlug: new Map(),
  publicSupermercados: [],
  publicSupermercadosPorId: new Map(),
  ofertasPublicasPorSuper: new Map(),
  ofertasPublicasIndex: new Map(),
  mejoresPrecios: new Map(),
};

let dbPromise;

export function getSelectedCity() {
  return window.localStorage.getItem(CITY_KEY);
}

export function setSelectedCity(city) {
  if (city) {
    window.localStorage.setItem(CITY_KEY, city);
  }
}

const LEGACY_CART_KEY = 'xanaeslab:cart';

export function getCart() {
  try {
    let raw = window.localStorage.getItem(CART_KEY);
    if (!raw) {
      const legacy = window.localStorage.getItem(LEGACY_CART_KEY);
      if (legacy) {
        window.localStorage.setItem(CART_KEY, legacy);
        window.localStorage.removeItem(LEGACY_CART_KEY);
        raw = legacy;
      }
    }
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Error leyendo lista de compras', error);
    return [];
  }
}

export function persistCart(items) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  try {
    window.localStorage.removeItem(LEGACY_CART_KEY);
  } catch (_) {
    // ignorar
  }
}

export function getPreferences() {
  try {
    return JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

export function setPreference(key, value) {
  const prefs = getPreferences();
  prefs[key] = value;
  window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
}

function normalizarCiudad(item) {
  return {
    id: Number(item.id),
    nombre: item.name,
    slug: item.slug,
    provincia: item.state,
    creado: item.created_at,
    actualizado: item.updated_at,
  };
}

function normalizarCategoria(item) {
  return {
    id: Number(item.id),
    nombre: item.name || '',
    slug: item.slug || '',
    descripcion: item.description || '',
  };
}

function normalizarProducto(item) {
  return {
    id: Number(item.id),
    nombre: item.name || '',
    marca: item.brand || '',
    codigo: item.barcode || '',
    unidad: item.unit || '',
    presentacion: item.size || '',
    categoria_id: item.category_id !== null && item.category_id !== undefined ? Number(item.category_id) : null,
    categoria: item.category_name || '',
    categoria_slug: item.category_slug || '',
    creado: item.created_at,
    actualizado: item.updated_at,
  };
}

export async function fetchCities({ force = false } = {}) {
  if (!force && caches.ciudades.size) {
    return Array.from(caches.ciudades.values());
  }
  try {
    const response = await citiesList({ limit: 100 });
    const items = response.items || response.results || [];
    caches.ciudades.clear();
    caches.ciudadesPorNombre.clear();
    caches.ciudadesPorSlug.clear();
    items.forEach((item) => {
      const ciudad = normalizarCiudad(item);
      caches.ciudades.set(ciudad.id, ciudad);
      caches.ciudadesPorNombre.set(ciudad.nombre, ciudad);
      caches.ciudadesPorSlug.set(ciudad.slug, ciudad);
    });
    return Array.from(caches.ciudades.values());
  } catch (error) {
    console.error('No se pudieron cargar las ciudades', error);
    return Array.from(caches.ciudades.values());
  }
}

export function getCityByName(nombre) {
  if (!nombre) return null;
  return caches.ciudadesPorNombre.get(nombre) || null;
}

export async function fetchCategorias({ force = false } = {}) {
  if (!force && caches.categorias.size) {
    return Array.from(caches.categorias.values());
  }
  try {
    const response = await categoriesList({ limit: 200 });
    const items = response.items || response.results || [];
    caches.categorias.clear();
    caches.categoriasPorSlug.clear();
    items.forEach((item) => {
      const categoria = normalizarCategoria(item);
      caches.categorias.set(categoria.id, categoria);
      if (categoria.slug) {
        caches.categoriasPorSlug.set(categoria.slug, categoria);
      }
    });
    return Array.from(caches.categorias.values());
  } catch (error) {
    console.error('No se pudieron cargar las categorías', error);
    return Array.from(caches.categorias.values());
  }
}

export function getCategoriaPorSlug(slug) {
  if (!slug) return null;
  return caches.categoriasPorSlug.get(slug) || null;
}

function openDatabase() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('supermercados')) {
          db.createObjectStore('supermercados', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('productos_canonicos')) {
          db.createObjectStore('productos_canonicos', { keyPath: 'id', autoIncrement: true });
          db.createObjectStore('productos_por_clave', { keyPath: 'clave' });
        }
        if (!db.objectStoreNames.contains('ofertas')) {
          const store = db.createObjectStore('ofertas', { keyPath: 'id', autoIncrement: true });
          store.createIndex('por_ciudad', 'ciudad');
          store.createIndex('por_producto', 'producto_id');
          store.createIndex('por_super', 'supermercado_id');
          store.createIndex('por_vigencia', 'vigencia_desde');
        }
        if (!db.objectStoreNames.contains('importaciones')) {
          db.createObjectStore('importaciones', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('ajustes')) {
          db.createObjectStore('ajustes', { keyPath: 'id', autoIncrement: true });
          db.createObjectStore('ajustes_por_clave', { keyPath: 'clave' });
        }
      };
    });
  }
  return dbPromise;
}

export async function clearCaches() {
  caches.supermercados.clear();
  caches.supermercadosRemotos.clear();
  caches.productos.clear();
  caches.ofertas = [];
  caches.importaciones = [];
  caches.ajustes.clear();
  caches.ciudades.clear();
  caches.ciudadesPorNombre.clear();
  caches.ciudadesPorSlug.clear();
  caches.categorias.clear();
  caches.categoriasPorSlug.clear();
  caches.publicSupermercados = [];
  caches.publicSupermercadosPorId.clear();
  caches.ofertasPublicasPorSuper.clear();
  caches.ofertasPublicasIndex.clear();
  caches.mejoresPrecios.clear();
}

export async function getAll(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

export async function saveSupermercado(supermercado) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('supermercados', 'readwrite');
    const store = tx.objectStore('supermercados');
    const req = supermercado.id ? store.put(supermercado) : store.add(supermercado);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      caches.supermercados.set(req.result, { ...supermercado, id: req.result });
      resolve(req.result);
    };
  });
}

export async function deleteSupermercado(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('supermercados', 'readwrite');
    const store = tx.objectStore('supermercados');
    const req = store.delete(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      caches.supermercados.delete(id);
      resolve();
    };
  });
}

export async function upsertAjuste(clave, valor) {
  const db = await openDatabase();
  const tx = db.transaction(['ajustes', 'ajustes_por_clave'], 'readwrite');
  const ajustes = tx.objectStore('ajustes');
  const ajustesPorClave = tx.objectStore('ajustes_por_clave');
  ajustesPorClave.put({ clave, valor });
  ajustes.put({ id: crypto.randomUUID(), clave, valor, actualizado: new Date().toISOString() });
  caches.ajustes.set(clave, valor);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getAjuste(clave) {
  if (caches.ajustes.has(clave)) {
    return caches.ajustes.get(clave);
  }
  const db = await openDatabase();
  return new Promise((resolve) => {
    const tx = db.transaction('ajustes_por_clave', 'readonly');
    const store = tx.objectStore('ajustes_por_clave');
    const req = store.get(clave);
    req.onsuccess = () => {
      const value = req.result?.valor;
      if (value !== undefined) caches.ajustes.set(clave, value);
      resolve(value);
    };
    req.onerror = () => resolve(undefined);
  });
}

function canonicalKey({ nombre, marca, presentacion }) {
  return `${nombre}`.toLowerCase().trim() + '|' + `${marca}`.toLowerCase().trim() + '|' + formatPresentation(presentacion).toLowerCase();
}

async function upsertProductoCanonico(db, producto) {
  const key = canonicalKey(producto);
  const tx = db.transaction(['productos_canonicos', 'productos_por_clave'], 'readwrite');
  const store = tx.objectStore('productos_canonicos');
  const porClave = tx.objectStore('productos_por_clave');
  const existing = await new Promise((resolve) => {
    const req = porClave.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  if (existing) {
    caches.productos.set(existing.id, existing);
    return existing.id;
  }
  const newProduct = { ...producto, clave: key };
  const id = await new Promise((resolve, reject) => {
    const addReq = store.add(newProduct);
    addReq.onsuccess = () => resolve(addReq.result);
    addReq.onerror = () => reject(addReq.error);
  });
  porClave.put({ clave: key, id, ...newProduct });
  const stored = { ...newProduct, id };
  caches.productos.set(id, stored);
  return id;
}

function normalizarCantidadBase(presentacion, sku) {
  const text = `${presentacion} ${sku || ''}`.toLowerCase();
  const match = text.match(/(\d+[\.,]?\d*)\s*(kg|g|l|ml|un|u|unidad|unidades)/);
  if (!match) {
    return { unidad_base: 'u', cantidad_base: 1 };
  }
  const cantidad = parseNumber(match[1]) || 1;
  const unidadRaw = match[2];
  if (unidadRaw.includes('kg')) {
    return { unidad_base: 'g', cantidad_base: Math.round(cantidad * 1000) };
  }
  if (unidadRaw.includes('g')) {
    return { unidad_base: 'g', cantidad_base: Math.round(cantidad) };
  }
  if (unidadRaw.includes('ml')) {
    return { unidad_base: 'ml', cantidad_base: Math.round(cantidad) };
  }
  if (unidadRaw.includes('l')) {
    return { unidad_base: 'ml', cantidad_base: Math.round(cantidad * 1000) };
  }
  return { unidad_base: 'u', cantidad_base: Math.max(1, Math.round(cantidad)) };
}

function calcularPrecioEfectivo(oferta) {
  const precio = oferta.precio_individual;
  switch (oferta.promo_tipo) {
    case '2x1':
      return precio / 2;
    case '3x2':
      return precio * (2 / 3);
    case '2da_50':
      return precio * 0.75;
    case 'porcentaje':
      return precio * (1 - (oferta.promo_param || 0) / 100);
    case 'suma_fija':
      return oferta.promo_param ? (oferta.promo_param / 3) : precio;
    case 'precio_unidad':
      return precio;
    default:
      return precio;
  }
}

function calcularPrecioBase(oferta) {
  if (!oferta.cantidad_base || oferta.cantidad_base <= 0) return null;
  return oferta.precio_individual / oferta.cantidad_base_normalizada;
}

function calcularPrecioBaseEfectivo(oferta) {
  if (!oferta.cantidad_base || oferta.cantidad_base <= 0) return null;
  return oferta.precio_efectivo / oferta.cantidad_base_normalizada;
}

function evaluarFilaBase(fila, ciudadesValidas) {
  const errors = [];
  const supermercado = fila.supermercado?.trim();
  const ciudad = fila.ciudad?.trim();
  const producto = fila.producto?.trim();
  const marca = fila.marca?.trim();
  const presentacion = formatPresentation(fila.presentacion);
  if (!supermercado) errors.push('Supermercado requerido');
  if (!ciudad || (ciudadesValidas?.size && !ciudadesValidas.has(ciudad))) errors.push('Ciudad inválida');
  if (!producto) errors.push('Producto requerido');
  if (!marca) errors.push('Marca requerida');
  if (!presentacion) errors.push('Presentación requerida');
  const precioIndividual = parseNumber(fila.precio_individual);
  const precioTotal = parseNumber(fila.precio_total) || precioIndividual;
  if (!precioIndividual || precioIndividual <= 0) errors.push('Precio individual inválido');
  if (!precioTotal || precioTotal <= 0) errors.push('Precio total inválido');
  const vigenciaDesde = parseDate(fila.vigencia_desde);
  const vigenciaHasta = parseDate(fila.vigencia_hasta);
  if (!vigenciaDesde || !vigenciaHasta) errors.push('Vigencias inválidas');
  if (vigenciaDesde && vigenciaHasta && new Date(vigenciaDesde) > new Date(vigenciaHasta)) {
    errors.push('vigencia_desde mayor a vigencia_hasta');
  }
  return {
    errors,
    supermercado,
    ciudad,
    categoria: fila.categoria?.trim() || 'Sin categoría',
    producto,
    marca,
    presentacion,
    sku_presentacion_capturada: fila.sku_presentacion_capturada?.trim() || '',
    promo_tipo: fila.promo_tipo?.trim() || 'ninguna',
    promo_param: parseNumber(fila.promo_param) || null,
    promo_condicion: fila.promo_condicion?.trim() || '',
    precio_individual: precioIndividual,
    precio_total: precioTotal,
    moneda: fila.moneda?.trim() || 'ARS',
    vigencia_desde: vigenciaDesde,
    vigencia_hasta: vigenciaHasta,
    fuente: fila.fuente?.trim() || '',
    id_externo: fila.id_externo?.trim() || '',
    pagina: fila.pagina?.trim() || '',
    posicion: fila.posicion?.trim() || ''
  };
}

function esDuplicado(oferta, existente) {
  return (
    oferta.supermercado === existente.supermercado &&
    oferta.ciudad === existente.ciudad &&
    oferta.producto === existente.producto &&
    oferta.marca === existente.marca &&
    oferta.presentacion === existente.presentacion &&
    oferta.vigencia_desde === existente.vigencia_desde &&
    oferta.vigencia_hasta === existente.vigencia_hasta
  );
}

export async function importarFilas(filas, onProgress = () => {}) {
  const db = await openDatabase();
  const resultados = [];
  let ok = 0; let dup = 0; let err = 0;

  const ciudadesDisponibles = await fetchCities().catch(() => []);
  const ciudadesValidas = new Set((ciudadesDisponibles || []).map(ciudad => ciudad.nombre));

  const ofertasExistentes = await getAll('ofertas');
  const dedupeKey = new Set(ofertasExistentes.map(o => `${o.supermercado}|${o.ciudad}|${o.producto}|${o.marca}|${o.presentacion}|${o.vigencia_desde}|${o.vigencia_hasta}`));

  for (let i = 0; i < filas.length; i++) {
    const base = evaluarFilaBase(filas[i], ciudadesValidas);
    if (base.errors.length) {
      resultados.push({ status: 'error', fila: filas[i], errores: base.errors });
      err++;
      onProgress({ current: i + 1, total: filas.length, ok, dup, err });
      continue;
    }
    const key = `${base.supermercado}|${base.ciudad}|${base.producto}|${base.marca}|${base.presentacion}|${base.vigencia_desde}|${base.vigencia_hasta}`;
    if (dedupeKey.has(key)) {
      resultados.push({ status: 'duplicada', fila: filas[i] });
      dup++;
      onProgress({ current: i + 1, total: filas.length, ok, dup, err });
      continue;
    }
    dedupeKey.add(key);
    const productoId = await upsertProductoCanonico(db, {
      nombre: base.producto,
      marca: base.marca,
      categoria: base.categoria,
      presentacion: base.presentacion,
    });
    const supermercado = await ensureSupermercado(db, base.supermercado, base.ciudad);
    const cantidadBase = normalizarCantidadBase(base.presentacion, base.sku_presentacion_capturada);
    const cantidad_base_normalizada = cantidadBase.cantidad_base;
    const oferta = {
      ...base,
      producto_id: productoId,
      supermercado_id: supermercado.id,
      unidad_base: cantidadBase.unidad_base,
      cantidad_base: cantidadBase.cantidad_base,
      cantidad_base_normalizada,
    };
    oferta.min_cantidad_para_promo = promoMinimumQuantity(oferta) || null;
    oferta.precio_efectivo = calcularPrecioEfectivo(oferta);
    oferta.precio_por_base = calcularPrecioBase(oferta);
    oferta.precio_por_base_efectivo = calcularPrecioBaseEfectivo(oferta);

    await new Promise((resolve, reject) => {
      const tx = db.transaction('ofertas', 'readwrite');
      const store = tx.objectStore('ofertas');
      const req = store.add(oferta);
      req.onsuccess = () => {
        caches.ofertas.push({ ...oferta, id: req.result });
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
    resultados.push({ status: 'ok', fila: filas[i], oferta });
    ok++;
    onProgress({ current: i + 1, total: filas.length, ok, dup, err });
  }

  caches.ofertas.sort((a, b) => new Date(b.vigencia_desde) - new Date(a.vigencia_desde));

  return { resultados, resumen: { ok, dup, err } };
}

async function ensureSupermercado(db, nombre, ciudad) {
  for (const cached of caches.supermercados.values()) {
    if (cached.nombre === nombre && cached.ciudad === ciudad) return cached;
  }
  const existing = await getAll('supermercados');
  const match = existing.find(s => s.nombre === nombre && s.ciudad === ciudad);
  if (match) {
    caches.supermercados.set(match.id, match);
    return match;
  }
  const nuevo = { nombre, ciudad, direccion: '', maps_url: '', activo: true };
  const id = await new Promise((resolve, reject) => {
    const tx = db.transaction('supermercados', 'readwrite');
    const store = tx.objectStore('supermercados');
    const req = store.add(nuevo);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const almacenado = { ...nuevo, id };
  caches.supermercados.set(id, almacenado);
  return almacenado;
}

export async function fetchOfertasPorCiudad(ciudad) {
  if (!ciudad) return [];
  if (caches.ofertas.length) {
    return caches.ofertas.filter(oferta => oferta.ciudad === ciudad);
  }
  const todas = await getAll('ofertas');
  caches.ofertas = todas;
  return todas.filter(oferta => oferta.ciudad === ciudad);
}

export async function fetchProductos(options = {}) {
  return fetchProductosRemotos(options);
}

export async function fetchProductosRemotos({ force = false, filters = {} } = {}) {
  const hasFilters = Object.keys(filters).length > 0;
  if (!force && !hasFilters && caches.productos.size) {
    return Array.from(caches.productos.values());
  }
  const params = { limit: 200, ...filters };
  try {
    const response = await productsList(params);
    const items = response.items || response.results || [];
    const normalizados = items.map(normalizarProducto);
    if (!hasFilters) {
      caches.productos.clear();
      normalizados.forEach((producto) => {
        caches.productos.set(producto.id, producto);
      });
    }
    return normalizados;
  } catch (error) {
    console.error('No se pudieron cargar los productos', error);
    return hasFilters ? [] : Array.from(caches.productos.values());
  }
}

function normalizarSupermercadoApi(item, ciudadInfo) {
  const ciudad = ciudadInfo || getCityByName(item.city ?? item.city_name ?? '');
  return {
    id: Number(item.id),
    nombre: item.name || item.nombre || '',
    slug: item.slug || '',
    ciudad: item.city ?? item.city_name ?? ciudad?.nombre ?? '',
    ciudad_id: Number(item.city_id ?? ciudad?.id ?? 0) || null,
    ciudad_slug: item.city_slug ?? ciudad?.slug ?? '',
    provincia: item.city_state ?? ciudad?.provincia ?? item.state ?? '',
    direccion: item.address || '',
    telefono: item.phone || '',
    website: item.website || '',
    zip: item.zip || '',
    activo: Boolean(item.is_active ?? true),
    horarios: '',
    maps_url: item.maps_url || item.website || '',
    origen: 'api',
    creado: item.created_at,
    actualizado: item.updated_at,
  };
}

export async function fetchSupermarketsFromApi(ciudad, { force = false } = {}) {
  if (!ciudad) return [];
  const ciudades = await fetchCities();
  const ciudadInfo = ciudades.find(c => c.nombre === ciudad || c.slug === ciudad || String(c.id) === String(ciudad));
  if (!ciudadInfo) return [];
  if (!force && caches.supermercadosRemotos.has(ciudadInfo.id)) {
    return caches.supermercadosRemotos.get(ciudadInfo.id);
  }
  try {
    const response = await supermarketsList({ city_id: ciudadInfo.id, is_active: 1, limit: 200 });
    const items = response.items || response.results || [];
    const normalizados = items.map(item => normalizarSupermercadoApi(item, ciudadInfo));
    caches.supermercadosRemotos.set(ciudadInfo.id, normalizados);
    return normalizados;
  } catch (error) {
    console.error('No se pudieron obtener supermercados del backend', error);
    throw error;
  }
}

export async function fetchSupermercados(ciudad, { force = false } = {}) {
  try {
    const remotos = await fetchSupermarketsFromApi(ciudad, { force });
    return remotos;
  } catch (error) {
    // fallback a datos locales solo si hay información previa del importador
  }
  if (caches.supermercados.size && !force) {
    return Array.from(caches.supermercados.values()).filter(s => (ciudad ? s.ciudad === ciudad : true));
  }
  const data = await getAll('supermercados');
  data.forEach(s => caches.supermercados.set(s.id, s));
  return data.filter(s => (ciudad ? s.ciudad === ciudad : true));
}

export async function registrarImportacion(resumen) {
  const db = await openDatabase();
  const record = {
    id: crypto.randomUUID(),
    fecha: new Date().toISOString(),
    ...resumen,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction('importaciones', 'readwrite');
    const store = tx.objectStore('importaciones');
    const req = store.add(record);
    req.onsuccess = () => {
      caches.importaciones.push(record);
      resolve(record);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function listarImportaciones() {
  if (caches.importaciones.length) return caches.importaciones;
  const data = await getAll('importaciones');
  caches.importaciones = data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  return caches.importaciones;
}

export function parseCSV(texto) {
  const lines = texto.trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  const filas = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const values = line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(v => v.replace(/^\"|\"$/g, ''));
    const fila = {};
    headers.forEach((h, idx) => {
      fila[h.trim()] = values[idx] !== undefined ? values[idx] : '';
    });
    filas.push(fila);
  }
  return filas;
}

export async function ensureSeedData() {
  try {
    await openDatabase();
    const ofertas = await getAll('ofertas');
    caches.ofertas = ofertas;
  } catch (error) {
    console.warn('No se pudo inicializar el almacenamiento local', error);
  }
}

export function purgeVencidas(nowISO = new Date().toISOString()) {
  const now = new Date(nowISO);
  caches.ofertas = caches.ofertas.filter(oferta => new Date(oferta.vigencia_hasta) >= now);
  caches.ofertasPublicasPorSuper.forEach((lista, superId) => {
    const vigentes = lista.filter(oferta => new Date(oferta.vigencia_hasta) >= now);
    caches.ofertasPublicasPorSuper.set(superId, vigentes);
  });
  caches.ofertasPublicasIndex.forEach((lista, productoId) => {
    const vigentes = lista.filter(oferta => new Date(oferta.vigencia_hasta) >= now);
    if (vigentes.length) {
      caches.ofertasPublicasIndex.set(productoId, vigentes);
    } else {
      caches.ofertasPublicasIndex.delete(productoId);
    }
  });
  return caches.ofertas;
}

export function computeEffectivePrice(oferta, prorrateo = false) {
  if (!prorrateo) return oferta.precio_individual;
  return oferta.precio_efectivo ?? oferta.precio_individual;
}

export function computeEffectiveUnitPrice(oferta, prorrateo = false) {
  if (!prorrateo) return oferta.precio_por_base;
  return oferta.precio_por_base_efectivo ?? oferta.precio_por_base;
}

export function makeLogCSV(resultados) {
  const headers = ['status', 'motivo', 'supermercado', 'ciudad', 'producto', 'marca', 'presentacion'];
  const lines = [headers.join(',')];
  for (const item of resultados) {
    const motivo = item.status === 'error' ? item.errores.join(' | ') : item.status;
    lines.push([
      item.status,
      `"${motivo}"`,
      item.fila.supermercado,
      item.fila.ciudad,
      item.fila.producto,
      item.fila.marca,
      item.fila.presentacion
    ].join(','));
  }
  return lines.join('\n');
}

export async function deleteOfertas(filterFn) {
  const db = await openDatabase();
  const ofertas = await getAll('ofertas');
  const toKeep = ofertas.filter(o => !filterFn(o));
  await new Promise((resolve, reject) => {
    const tx = db.transaction('ofertas', 'readwrite');
    const store = tx.objectStore('ofertas');
    const clearReq = store.clear();
    clearReq.onsuccess = () => {
      Promise.all(toKeep.map(item => new Promise((res, rej) => {
        const req = store.add(item);
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      }))).then(() => resolve()).catch(reject);
    };
    clearReq.onerror = () => reject(clearReq.error);
  });
  caches.ofertas = toKeep;
  return toKeep.length;
}

const PUBLIC_API_BASE = '/api';

function buildPublicUrl(path, params = {}) {
  const base = PUBLIC_API_BASE.endsWith('/') ? PUBLIC_API_BASE.slice(0, -1) : PUBLIC_API_BASE;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined && entry !== null && entry !== '') {
          search.append(key, entry);
        }
      });
    } else {
      search.append(key, value);
    }
  });
  const query = search.toString();
  return `${base}${cleanPath}${query ? `?${query}` : ''}`;
}

function normalizarSupermercadoPublico(item) {
  const id = Number(item?.id ?? item?.supermercado_id ?? item?.supermarket_id ?? 0) || 0;
  const nombre = item?.nombre ?? item?.name ?? 'Supermercado';
  const direccion = item?.direccion ?? item?.address ?? '';
  const ciudadRaw = item?.ciudad ?? item?.city ?? item?.city_name ?? '';
  const ciudad = normalizarCiudadPublica(ciudadRaw);
  const activo = item?.activo !== undefined ? Boolean(item.activo) : (item?.is_active !== undefined ? Boolean(item.is_active) : true);
  return {
    id,
    nombre,
    direccion,
    ciudad,
    maps_url: item?.maps_url ?? item?.mapsUrl ?? '',
    activo,
  };
}

function normalizarCiudadPublica(ciudad) {
  if (!ciudad) return '';
  const lower = ciudad.toLowerCase();
  if (lower.includes('rio segundo') || lower.includes('río segundo')) {
    return 'Río Segundo';
  }
  if (lower.includes('pilar')) {
    return 'Pilar';
  }
  return ciudad;
}

function normalizarFechaPublica(value) {
  if (!value) return null;
  const parsed = parseDate(value);
  if (parsed) return parsed;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizarOfertaPublica(item, supermercadoId) {
  const productoId = Number(item?.producto_id ?? item?.product_id ?? item?.id_producto ?? 0) || 0;
  const precioIndividual = parseNumber(item?.precio_individual ?? item?.precio ?? item?.price);
  const precioBase = parseNumber(item?.precio_por_base ?? item?.precio_base ?? item?.price_base);
  const precioEfectivo = parseNumber(item?.precio_efectivo ?? item?.precioPromo ?? item?.precio_total);
  const cantidadBase = parseNumber(item?.cantidad_base ?? item?.cantidadBase);
  const cantidadNormalizada = parseNumber(item?.cantidad_base_normalizada ?? item?.cantidadNormalizada);
  const minPromo = parseNumber(item?.min_cantidad_para_promo ?? item?.cantidad_minima ?? item?.cantidadMinima);
  const ofertaId = item?.oferta_id ?? item?.id ?? `${supermercadoId}-${productoId}`;
  const presentacion = formatPresentation(item?.presentacion ?? item?.presentacion_corta ?? item?.presentacion_larga ?? item?.size ?? '');
  const normalized = {
    id: ofertaId,
    oferta_id: ofertaId,
    producto_id: productoId,
    producto: item?.nombre ?? item?.producto ?? item?.product_name ?? '',
    marca: item?.marca ?? item?.brand ?? '',
    presentacion,
    precio_individual: precioIndividual ?? 0,
    precio_por_base: precioBase ?? null,
    precio_efectivo: precioEfectivo ?? null,
    precio_por_base_efectivo: item?.precio_por_base_efectivo ? parseNumber(item.precio_por_base_efectivo) : null,
    promo_tipo: item?.promo_tipo ?? 'ninguna',
    promo_param: parseNumber(item?.promo_param ?? item?.promo_parametro ?? item?.promo_valor),
    promo_condicion: item?.promo_condicion ?? item?.promo_condicion_texto ?? '',
    min_cantidad_para_promo: minPromo ?? null,
    cantidad_base: cantidadBase ?? null,
    cantidad_base_normalizada: cantidadNormalizada ?? null,
    unidad_base: item?.unidad_base ?? item?.unidadBase ?? item?.unidad ?? '',
    vigencia_desde: normalizarFechaPublica(item?.vigencia_desde ?? item?.vigenciaDesde ?? item?.desde),
    vigencia_hasta: normalizarFechaPublica(item?.vigencia_hasta ?? item?.vigenciaHasta ?? item?.hasta),
    imagen_url: item?.imagen_url ?? item?.imagen ?? item?.image ?? null,
    supermercado_id: Number(item?.supermercado_id ?? supermercadoId ?? 0) || 0,
    supermercado_nombre: item?.supermercado_nombre ?? item?.supermercado ?? '',
  };
  if (normalized.min_cantidad_para_promo === null || normalized.min_cantidad_para_promo === undefined) {
    const calculada = promoMinimumQuantity(normalized);
    if (calculada) {
      normalized.min_cantidad_para_promo = calculada;
    }
  }
  return normalized;
}

function esOfertaVigente(oferta, now = new Date()) {
  if (!oferta?.vigencia_hasta) return true;
  const fecha = new Date(oferta.vigencia_hasta);
  if (Number.isNaN(fecha.getTime())) return true;
  return fecha >= now;
}

function almacenarOfertasPublicas(supermercadoId, ofertas) {
  caches.ofertasPublicasPorSuper.set(supermercadoId, ofertas);
  caches.ofertasPublicasIndex.forEach((lista, productoId) => {
    const filtradas = lista.filter(oferta => oferta.supermercado_id !== supermercadoId);
    if (filtradas.length) {
      caches.ofertasPublicasIndex.set(productoId, filtradas);
    } else {
      caches.ofertasPublicasIndex.delete(productoId);
    }
  });
  ofertas.forEach((oferta) => {
    if (!oferta?.producto_id) return;
    const lista = caches.ofertasPublicasIndex.get(oferta.producto_id) || [];
    lista.push(oferta);
    caches.ofertasPublicasIndex.set(oferta.producto_id, lista);
  });
}

function computeLocalBestPrice(productoId) {
  const ofertas = caches.ofertasPublicasIndex.get(productoId) || [];
  const vigentes = ofertas.filter(oferta => esOfertaVigente(oferta));
  if (!vigentes.length) {
    return null;
  }
  const ordenadas = vigentes.slice().sort((a, b) => {
    const diff = (a.precio_individual ?? 0) - (b.precio_individual ?? 0);
    if (Math.abs(diff) > 0.0001) {
      return diff;
    }
    const nombreA = (a.supermercado_nombre || getPublicSupermarketById(a.supermercado_id)?.nombre || '').toLowerCase();
    const nombreB = (b.supermercado_nombre || getPublicSupermarketById(b.supermercado_id)?.nombre || '').toLowerCase();
    return nombreA.localeCompare(nombreB, 'es');
  });
  const mejor = ordenadas[0];
  const minPrecio = mejor?.precio_individual ?? 0;
  const ganadores = ordenadas.filter(oferta => Math.abs((oferta.precio_individual ?? 0) - minPrecio) < 0.0001);
  const unico = ordenadas.length === 1;
  const empate = ganadores.length > 1;
  const mejorSuper = mejor?.supermercado_nombre || getPublicSupermarketById(mejor?.supermercado_id)?.nombre || '';
  const resultado = {
    producto_id: productoId,
    mejor_supermercado: mejorSuper,
    mejor_precio: minPrecio,
    empate,
    unico,
  };
  caches.mejoresPrecios.set(productoId, resultado);
  return resultado;
}

export async function fetchPublicSupermarkets({ force = false } = {}) {
  if (!force && caches.publicSupermercados.length) {
    return caches.publicSupermercados.slice();
  }
  try {
    const response = await fetch(buildPublicUrl('/supermercados'));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : (payload?.items || payload?.results || []);
    const normalizados = items.map(normalizarSupermercadoPublico).filter(item => item.activo !== false);
    normalizados.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    caches.publicSupermercados = normalizados;
    caches.publicSupermercadosPorId = new Map(normalizados.map(item => [item.id, item]));
    return normalizados.slice();
  } catch (error) {
    console.warn('Fallo al obtener supermercados públicos', error);
  }
  const fallback = await fetchSupermercados(null, { force });
  if (Array.isArray(fallback) && fallback.length) {
    const normalizados = fallback
      .filter(item => item.activo !== false)
      .map(item => ({
        id: Number(item.id),
        nombre: item.nombre || 'Supermercado',
        direccion: item.direccion || '',
        ciudad: normalizarCiudadPublica(item.ciudad || ''),
        maps_url: item.maps_url || '',
        activo: item.activo !== false,
      }));
    normalizados.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    caches.publicSupermercados = normalizados;
    caches.publicSupermercadosPorId = new Map(normalizados.map(item => [item.id, item]));
    return normalizados.slice();
  }
  return caches.publicSupermercados.slice();
}

export function getPublicSupermarketById(id) {
  if (!id) return null;
  return caches.publicSupermercadosPorId.get(Number(id)) || null;
}

export async function fetchOffersForSupermarket(supermercadoId, { force = false } = {}) {
  const superId = Number(supermercadoId);
  if (!Number.isFinite(superId) || superId <= 0) {
    return [];
  }
  if (!force && caches.ofertasPublicasPorSuper.has(superId)) {
    return caches.ofertasPublicasPorSuper.get(superId).slice();
  }
  await fetchPublicSupermercados();
  try {
    const response = await fetch(buildPublicUrl('/ofertas', { vigentes: 1, supermercado_id: superId }));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : (payload?.items || payload?.results || []);
    const now = new Date();
    const normalizados = items
      .map(item => normalizarOfertaPublica(item, superId))
      .map(oferta => ({
        ...oferta,
        supermercado_nombre: oferta.supermercado_nombre || getPublicSupermarketById(oferta.supermercado_id)?.nombre || '',
      }))
      .filter(oferta => esOfertaVigente(oferta, now));
    almacenarOfertasPublicas(superId, normalizados);
    normalizados.forEach(oferta => computeLocalBestPrice(oferta.producto_id));
    return normalizados.slice();
  } catch (error) {
    console.warn('Fallo al obtener ofertas por supermercado', error);
  }
  if (caches.ofertasPublicasPorSuper.has(superId)) {
    return caches.ofertasPublicasPorSuper.get(superId).slice();
  }
  return [];
}

async function requestBestPrices(productoIds) {
  if (!productoIds.length) return new Map();
  try {
    const params = new URLSearchParams();
    productoIds.forEach(id => {
      params.append('producto_id[]', id);
    });
    params.append('vigentes', '1');
    const queryParams = {};
    for (const [key, value] of params.entries()) {
      if (!queryParams[key]) {
        queryParams[key] = [];
      }
      queryParams[key].push(value);
    }
    const url = buildPublicUrl('/mejor-precio', queryParams);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    const registros = Array.isArray(payload) ? payload : (payload?.items || payload?.results || (payload?.producto_id ? [payload] : []));
    const map = new Map();
    registros.forEach((item) => {
      const productoId = Number(item?.producto_id ?? item?.id ?? 0) || 0;
      if (!productoId) return;
      const info = {
        producto_id: productoId,
        mejor_supermercado: item?.mejor_supermercado ?? item?.supermercado ?? '',
        mejor_precio: parseNumber(item?.mejor_precio ?? item?.precio ?? item?.price) ?? null,
        empate: Boolean(item?.empate),
        unico: Boolean(item?.unico),
      };
      caches.mejoresPrecios.set(productoId, info);
      map.set(productoId, info);
    });
    return map;
  } catch (error) {
    console.warn('Fallo al obtener mejores precios globales', error);
    return new Map();
  }
}

export async function fetchBestPrices(productoIds, { force = false } = {}) {
  const ids = Array.from(new Set(productoIds.map(id => Number(id)).filter(id => Number.isFinite(id) && id > 0)));
  const resultado = new Map();
  const pendientes = [];
  ids.forEach((id) => {
    if (!force && caches.mejoresPrecios.has(id)) {
      resultado.set(id, caches.mejoresPrecios.get(id));
    } else {
      pendientes.push(id);
    }
  });
  if (pendientes.length) {
    const remotos = await requestBestPrices(pendientes);
    pendientes.forEach((id) => {
      if (remotos.has(id)) {
        resultado.set(id, remotos.get(id));
      }
    });
  }
  ids.forEach((id) => {
    if (!resultado.has(id)) {
      const local = computeLocalBestPrice(id);
      if (local) {
        resultado.set(id, local);
      }
    }
  });
  return resultado;
}

export function getCaches() {
  return caches;
}
