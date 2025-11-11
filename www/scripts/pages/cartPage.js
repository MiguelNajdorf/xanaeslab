import {
  cartCreateOrGet,
  cartAddItem,
  cartUpdateItem,
  cartGet,
  cartFinalize,
} from '../apiClient.js';

const CART_TOKEN_KEY = 'xanaeslab:sessionToken';

let cartId = null;
let sessionToken = null;

document.addEventListener('DOMContentLoaded', async () => {
  const status = document.getElementById('cart-status');
  const addForm = document.getElementById('add-form');
  const table = document.getElementById('cart-table');
  const refreshBtn = document.getElementById('refresh-cart');
  const finalizeBtn = document.getElementById('finalize-cart');
  const finalizeStatus = document.getElementById('finalize-status');

  sessionToken = localStorage.getItem(CART_TOKEN_KEY) || null;

  try {
    const result = await cartCreateOrGet(sessionToken ? { session_token: sessionToken } : {});
    cartId = result.cart_id;
    sessionToken = result.session_token || sessionToken;
    if (sessionToken) {
      localStorage.setItem(CART_TOKEN_KEY, sessionToken);
    }
    status.textContent = `Carrito #${cartId}`;
    status.classList.add('success');
    await loadCart();
  } catch (error) {
    status.textContent = error.message || 'No se pudo crear el carrito';
    status.classList.add('error');
    disablePage();
    return;
  }

  addForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(addForm);
    const productId = Number(formData.get('product_id'));
    const quantity = Number(formData.get('quantity'));
    status.textContent = 'Agregando producto…';
    status.className = 'status';
    try {
      const payload = buildCartPayload({ product_id: productId, quantity });
      const response = await cartAddItem(payload);
      cartId = response.cart_id;
      if (response.session_token) {
        sessionToken = response.session_token;
        localStorage.setItem(CART_TOKEN_KEY, sessionToken);
      }
      status.textContent = 'Producto agregado al carrito.';
      status.classList.add('success');
      addForm.reset();
      await loadCart();
    } catch (error) {
      status.textContent = error.message || 'No se pudo agregar el producto';
      status.classList.add('error');
    }
  });

  refreshBtn?.addEventListener('click', () => {
    loadCart();
  });

  finalizeBtn?.addEventListener('click', async () => {
    finalizeStatus.textContent = 'Finalizando carrito…';
    finalizeStatus.className = 'status';
    try {
      const payload = buildCartPayload({});
      const result = await cartFinalize(payload);
      finalizeStatus.textContent = `Carrito ${result.status}`;
      finalizeStatus.classList.add('success');
      await loadCart();
    } catch (error) {
      finalizeStatus.textContent = error.message || 'No se pudo finalizar';
      finalizeStatus.classList.add('error');
    }
  });

  async function loadCart() {
    table.innerHTML = '<tr><td colspan="4">Cargando…</td></tr>';
    try {
      const payload = cartId ? { cart_id: cartId } : { session_token: sessionToken };
      const data = await cartGet(payload);
      const items = data.items || [];
      if (!items.length) {
        table.innerHTML = '<tr><td colspan="4">El carrito está vacío.</td></tr>';
        return;
      }
      table.innerHTML = '';
      items.forEach((item) => {
        const tr = document.createElement('tr');
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.min = '0';
        quantityInput.step = '0.1';
        quantityInput.value = Number(item.quantity).toString();
        const updateBtn = document.createElement('button');
        updateBtn.textContent = 'Actualizar';
        updateBtn.className = 'button ghost';
        updateBtn.addEventListener('click', async () => {
          await updateQuantity(item.product_id, Number(quantityInput.value));
        });
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Eliminar';
        removeBtn.className = 'button secondary';
        removeBtn.addEventListener('click', async () => {
          await updateQuantity(item.product_id, 0);
        });
        const actions = document.createElement('div');
        actions.className = 'actions';
        actions.append(updateBtn, removeBtn);
        const desc = `${item.name || ''} ${item.brand ? '(' + item.brand + ')' : ''}`.trim() || `Producto ${item.product_id}`;
        tr.innerHTML = `
          <td>${item.product_id}</td>
          <td>${desc}</td>
        `;
        const quantityCell = document.createElement('td');
        quantityCell.appendChild(quantityInput);
        const actionsCell = document.createElement('td');
        actionsCell.appendChild(actions);
        tr.appendChild(quantityCell);
        tr.appendChild(actionsCell);
        table.appendChild(tr);
      });
    } catch (error) {
      table.innerHTML = `<tr><td colspan="4">${error.message}</td></tr>`;
    }
  }

  async function updateQuantity(productId, quantity) {
    status.textContent = 'Actualizando…';
    status.className = 'status';
    try {
      await cartUpdateItem({ ...buildCartPayload({ product_id: productId, quantity }), product_id: productId, quantity });
      status.textContent = quantity === 0 ? 'Producto eliminado.' : 'Cantidad actualizada.';
      status.classList.add('success');
      await loadCart();
    } catch (error) {
      status.textContent = error.message || 'No se pudo actualizar el carrito';
      status.classList.add('error');
    }
  }

  function disablePage() {
    addForm?.querySelectorAll('input,button').forEach((el) => el.setAttribute('disabled', 'disabled'));
    refreshBtn?.setAttribute('disabled', 'disabled');
    finalizeBtn?.setAttribute('disabled', 'disabled');
  }
});

function buildCartPayload(additional) {
  const payload = { ...additional };
  if (cartId) payload.cart_id = cartId;
  if (!cartId && sessionToken) payload.session_token = sessionToken;
  return payload;
}
