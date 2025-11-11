const DB_NAME = 'xanaes-lab-db';
const DB_VERSION = 1;
const STORES = {
  offers: 'offers',
  imports: 'imports',
  supermarkets: 'supermarkets',
  cart: 'cart'
};

let dbPromise;

export function initDb() {
  if (!('indexedDB' in window)) {
    throw new Error('IndexedDB no soportado');
  }
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.offers)) {
        const store = db.createObjectStore(STORES.offers, { keyPath: 'id' });
        store.createIndex('byProduct', ['producto', 'marca', 'presentacion'], { unique: false });
        store.createIndex('byCiudad', 'ciudad', { unique: false });
        store.createIndex('byCategoria', 'categoria', { unique: false });
        store.createIndex('bySupermercado', 'supermercado', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.imports)) {
        db.createObjectStore(STORES.imports, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORES.supermarkets)) {
        db.createObjectStore(STORES.supermarkets, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.cart)) {
        db.createObjectStore(STORES.cart, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function getDb() {
  if (!dbPromise) {
    await initDb();
  }
  return dbPromise;
}

export async function saveOffers(offers, metadata) {
  const db = await getDb();
  const tx = db.transaction([STORES.offers, STORES.imports], 'readwrite');
  const offersStore = tx.objectStore(STORES.offers);
  const importsStore = tx.objectStore(STORES.imports);

  for (const offer of offers) {
    await requestAsPromise(offersStore.put(offer));
  }
  await requestAsPromise(importsStore.add({
    timestamp: new Date().toISOString(),
    count: offers.length,
    metadata
  }));
  await transactionComplete(tx);
}

export async function overwriteOffers(offers, metadata) {
  const db = await getDb();
  const tx = db.transaction([STORES.offers, STORES.imports], 'readwrite');
  const offersStore = tx.objectStore(STORES.offers);
  const importsStore = tx.objectStore(STORES.imports);
  await requestAsPromise(offersStore.clear());
  for (const offer of offers) {
    await requestAsPromise(offersStore.put(offer));
  }
  await requestAsPromise(importsStore.add({
    timestamp: new Date().toISOString(),
    count: offers.length,
    metadata,
    overwrite: true
  }));
  await transactionComplete(tx);
}

export async function listOffers() {
  const db = await getDb();
  const tx = db.transaction(STORES.offers, 'readonly');
  const store = tx.objectStore(STORES.offers);
  const result = await requestAsPromise(store.getAll());
  await transactionComplete(tx);
  return result;
}

export async function clearAll() {
  const db = await getDb();
  const tx = db.transaction([STORES.offers, STORES.imports, STORES.cart], 'readwrite');
  await requestAsPromise(tx.objectStore(STORES.offers).clear());
  await requestAsPromise(tx.objectStore(STORES.imports).clear());
  await requestAsPromise(tx.objectStore(STORES.cart).clear());
  await transactionComplete(tx);
}

export async function getImportLog(limit = 20) {
  const db = await getDb();
  const tx = db.transaction(STORES.imports, 'readonly');
  const store = tx.objectStore(STORES.imports);
  const request = store.openCursor(null, 'prev');
  const results = [];
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
  });
}

export async function upsertSupermarkets(catalog) {
  const db = await getDb();
  const tx = db.transaction(STORES.supermarkets, 'readwrite');
  const store = tx.objectStore(STORES.supermarkets);
  for (const supermarket of catalog) {
    await requestAsPromise(store.put(supermarket));
  }
  await transactionComplete(tx);
}

export async function listSupermarkets() {
  const db = await getDb();
  const tx = db.transaction(STORES.supermarkets, 'readonly');
  const store = tx.objectStore(STORES.supermarkets);
  const data = await requestAsPromise(store.getAll());
  await transactionComplete(tx);
  return data;
}

export async function saveCart(cartItems) {
  const db = await getDb();
  const tx = db.transaction(STORES.cart, 'readwrite');
  const store = tx.objectStore(STORES.cart);
  await requestAsPromise(store.put({ id: 'default', items: cartItems }));
  await transactionComplete(tx);
}

export async function loadCart() {
  const db = await getDb();
  const tx = db.transaction(STORES.cart, 'readonly');
  const store = tx.objectStore(STORES.cart);
  const data = await requestAsPromise(store.get('default'));
  await transactionComplete(tx);
  return data?.items ?? [];
}

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function upsertOffer(offer) {
  const db = await getDb();
  const tx = db.transaction(STORES.offers, 'readwrite');
  await requestAsPromise(tx.objectStore(STORES.offers).put(offer));
  await transactionComplete(tx);
}

export async function deleteOffer(id) {
  const db = await getDb();
  const tx = db.transaction(STORES.offers, 'readwrite');
  await requestAsPromise(tx.objectStore(STORES.offers).delete(id));
  await transactionComplete(tx);
}
