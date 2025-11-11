import { getCart, persistCart } from './store.js';

const cart = getCart();

export function listarChanguito() {
  return cart.slice();
}

export function agregarAlChanguito(item) {
  const existing = cart.find(entry => entry.producto_id === item.producto_id);
  if (existing) {
    existing.cantidad += item.cantidad;
  } else {
    cart.push({ ...item });
  }
  persistCart(cart);
}

export function actualizarCantidad(productoId, cantidad) {
  const entry = cart.find(item => item.producto_id === productoId);
  if (!entry) return;
  entry.cantidad = Math.max(1, cantidad);
  persistCart(cart);
}

export function eliminarDelChanguito(productoId) {
  const idx = cart.findIndex(item => item.producto_id === productoId);
  if (idx >= 0) {
    cart.splice(idx, 1);
    persistCart(cart);
  }
}

export function vaciarChanguito() {
  cart.length = 0;
  persistCart(cart);
}

export function totalItems() {
  return cart.reduce((acc, item) => acc + item.cantidad, 0);
}
