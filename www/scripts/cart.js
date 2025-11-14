import { getCart, persistCart } from './store.js';

const shoppingList = getCart();

export function listarListaDeCompras() {
  return shoppingList.slice();
}

export function agregarAListaDeCompras(item) {
  const existing = shoppingList.find(entry => entry.producto_id === item.producto_id);
  if (existing) {
    existing.cantidad += item.cantidad;
  } else {
    shoppingList.push({ ...item });
  }
  persistCart(shoppingList);
}

export function actualizarCantidad(productoId, cantidad) {
  const entry = shoppingList.find(item => item.producto_id === productoId);
  if (!entry) return;
  entry.cantidad = Math.max(1, cantidad);
  persistCart(shoppingList);
}

export function eliminarDeListaDeCompras(productoId) {
  const idx = shoppingList.findIndex(item => item.producto_id === productoId);
  if (idx >= 0) {
    shoppingList.splice(idx, 1);
    persistCart(shoppingList);
  }
}

export function vaciarListaDeCompras() {
  shoppingList.length = 0;
  persistCart(shoppingList);
}

export function totalItems() {
  return shoppingList.reduce((acc, item) => acc + item.cantidad, 0);
}
