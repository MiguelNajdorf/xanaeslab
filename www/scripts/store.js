import { parseNumber, parseDate, formatPresentation, promoMinimumQuantity } from './format.js';

const DB_NAME = 'xanaeslab';
const DB_VERSION = 1;
const CITY_KEY = 'xanaeslab:city';
const CART_KEY = 'xanaeslab:cart';
const PREFERENCES_KEY = 'xanaeslab:prefs';

const caches = {
  supermercados: new Map(),
  productos: new Map(),
  ofertas: [],
  importaciones: [],
  ajustes: new Map(),
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

export function getCart() {
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Error leyendo changuito', error);
    return [];
  }
}

export function persistCart(items) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
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
  caches.productos.clear();
  caches.ofertas = [];
  caches.importaciones = [];
  caches.ajustes.clear();
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

function evaluarFilaBase(fila) {
  const errors = [];
  const supermercado = fila.supermercado?.trim();
  const ciudad = fila.ciudad?.trim();
  const producto = fila.producto?.trim();
  const marca = fila.marca?.trim();
  const presentacion = formatPresentation(fila.presentacion);
  if (!supermercado) errors.push('Supermercado requerido');
  if (!ciudad || !['Rio Segundo', 'Pilar'].includes(ciudad)) errors.push('Ciudad inválida');
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

  const ofertasExistentes = await getAll('ofertas');
  const dedupeKey = new Set(ofertasExistentes.map(o => `${o.supermercado}|${o.ciudad}|${o.producto}|${o.marca}|${o.presentacion}|${o.vigencia_desde}|${o.vigencia_hasta}`));

  for (let i = 0; i < filas.length; i++) {
    const base = evaluarFilaBase(filas[i]);
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

export async function fetchProductos() {
  if (caches.productos.size) return Array.from(caches.productos.values());
  const db = await openDatabase();
  const productos = await getAll('productos_canonicos');
  for (const p of productos) caches.productos.set(p.id, p);
  return productos;
}

export async function fetchSupermercados(ciudad) {
  if (caches.supermercados.size) {
    return Array.from(caches.supermercados.values()).filter(s => ciudad ? s.ciudad === ciudad : true);
  }
  const data = await getAll('supermercados');
  data.forEach(s => caches.supermercados.set(s.id, s));
  return data.filter(s => ciudad ? s.ciudad === ciudad : true);
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
  const ofertas = await getAll('ofertas');
  if (ofertas.length) {
    caches.ofertas = ofertas;
    return;
  }
  try {
    const response = await fetch('./data/sample.csv');
    const csv = await response.text();
    const filas = parseCSV(csv);
    await importarFilas(filas);
  } catch (error) {
    console.warn('No se pudo importar muestra inicial', error);
  }
}

export function purgeVencidas(nowISO = new Date().toISOString()) {
  caches.ofertas = caches.ofertas.filter(oferta => new Date(oferta.vigencia_hasta) >= new Date(nowISO));
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

export function getCaches() {
  return caches;
}
