const KEY = 'xanaes-preferences-v1';
const DEFAULTS = {
  ciudad: 'Rio Segundo',
  incluirBancos: false,
  orden: 'precio'
};

export function getPreferences() {
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) return { ...DEFAULTS };
    const parsed = JSON.parse(stored);
    return { ...DEFAULTS, ...parsed };
  } catch (error) {
    console.warn('No se pudo leer preferencias', error);
    return { ...DEFAULTS };
  }
}

export function savePreferences(preferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('No se pudo guardar preferencias', error);
  }
}

const CART_KEY = 'xanaes-cart-draft';

export function getDraftCart() {
  try {
    const stored = localStorage.getItem(CART_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('No se pudo leer changuito temporal', error);
    return [];
  }
}

export function saveDraftCart(items) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn('No se pudo guardar changuito temporal', error);
  }
}
