import {
  currentUser,
  supermarketsList,
  supermarketCreate,
  supermarketUpdate,
  supermarketDelete,
  storeHoursSet,
} from '../apiClient.js';

const weekdays = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

let selectedSuper = null;

document.addEventListener('DOMContentLoaded', async () => {
  const status = document.getElementById('page-status');
  const tableBody = document.getElementById('super-table');
  const searchForm = document.getElementById('search-form');
  const resetSearch = document.getElementById('reset-search');
  const form = document.getElementById('super-form');
  const formStatus = document.getElementById('super-status');
  const deleteBtn = document.getElementById('delete-super');
  const hoursGrid = document.getElementById('hours-grid');
  const hoursForm = document.getElementById('hours-form');
  const hoursStatus = document.getElementById('hours-status');

  createHoursInputs(hoursGrid);

  try {
    const user = await currentUser();
    if (user?.role !== 'admin') {
      status.textContent = 'Acceso restringido. Iniciá sesión como administrador.';
      status.classList.add('error');
      disablePage();
      return;
    }
    status.textContent = 'Sesión validada.';
    status.classList.add('success');
  } catch (error) {
    status.textContent = 'Sesión inválida. Volvé al login.';
    status.classList.add('error');
    disablePage();
    return;
  }

  async function loadList(params = {}) {
    tableBody.innerHTML = '<tr><td colspan="6">Cargando…</td></tr>';
    try {
      const data = await supermarketsList({ limit: 50, ...params });
      const items = data.items || data.results || [];
      if (!items.length) {
        tableBody.innerHTML = '<tr><td colspan="6">Sin resultados.</td></tr>';
        return;
      }
      tableBody.innerHTML = '';
      items.forEach((item) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${item.id}</td>
          <td>${item.name}</td>
          <td>${item.city || ''}</td>
          <td>${item.is_active ? '<span class="badge">Activo</span>' : '<span class="badge">Inactivo</span>'}</td>
          <td>${item.phone || ''}</td>
          <td><button type="button" class="button ghost" data-id="${item.id}">Editar</button></td>
        `;
        tr.querySelector('button').addEventListener('click', () => {
          selectSuper(item);
        });
        tableBody.appendChild(tr);
      });
    } catch (error) {
      tableBody.innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`;
    }
  }

  function selectSuper(item) {
    selectedSuper = item;
    const fields = ['id', 'name', 'slug', 'address', 'city', 'state', 'zip', 'phone', 'website'];
    fields.forEach((field) => {
      const input = form.elements[field];
      if (input) {
        input.value = item[field] ?? '';
      }
    });
    if (form.elements['is_active']) {
      form.elements['is_active'].value = item.is_active ? '1' : '0';
    }
    formStatus.textContent = `Editando supermercado #${item.id}`;
    formStatus.className = 'status';
  }

  function disablePage() {
    searchForm?.querySelectorAll('input,select,button').forEach((el) => el.setAttribute('disabled', 'disabled'));
    form?.querySelectorAll('input,select,button').forEach((el) => el.setAttribute('disabled', 'disabled'));
    hoursForm?.querySelectorAll('input,select,button').forEach((el) => el.setAttribute('disabled', 'disabled'));
  }

  function resetForm() {
    form.reset();
    selectedSuper = null;
    formStatus.textContent = '';
  }

  searchForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const params = Object.fromEntries(new FormData(searchForm).entries());
    loadList(params);
  });

  resetSearch?.addEventListener('click', () => {
    searchForm.reset();
    loadList();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.is_active = payload.is_active === '1';
    formStatus.textContent = 'Guardando…';
    formStatus.className = 'status';
    try {
      if (payload.id) {
        await supermarketUpdate(Number(payload.id), payload);
        formStatus.textContent = 'Supermercado actualizado correctamente.';
      } else {
        await supermarketCreate(payload);
        formStatus.textContent = 'Supermercado creado.';
      }
      formStatus.classList.add('success');
      await loadList(Object.fromEntries(new FormData(searchForm).entries()));
      resetForm();
    } catch (error) {
      formStatus.textContent = error.message || 'No se pudo guardar';
      formStatus.classList.add('error');
    }
  });

  deleteBtn?.addEventListener('click', async () => {
    if (!selectedSuper?.id) {
      formStatus.textContent = 'Seleccioná un supermercado de la tabla.';
      formStatus.classList.add('error');
      return;
    }
    if (!window.confirm('¿Eliminar este supermercado?')) return;
    formStatus.textContent = 'Eliminando…';
    formStatus.className = 'status';
    try {
      await supermarketDelete(selectedSuper.id, { force: false });
      formStatus.textContent = 'Supermercado eliminado (se marcó como inactivo).';
      formStatus.classList.add('success');
      await loadList(Object.fromEntries(new FormData(searchForm).entries()));
      resetForm();
    } catch (error) {
      formStatus.textContent = error.message || 'No se pudo eliminar';
      formStatus.classList.add('error');
    }
  });

  hoursForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedSuper?.id) {
      hoursStatus.textContent = 'Seleccioná un supermercado primero.';
      hoursStatus.classList.add('error');
      return;
    }
    const hours = Array.from(hoursForm.querySelectorAll('[data-weekday]')).map((container) => {
      const weekday = Number(container.dataset.weekday);
      const open = container.querySelector('input[name="open"]').value || null;
      const close = container.querySelector('input[name="close"]').value || null;
      return { weekday, open_time: open, close_time: close };
    });
    hoursStatus.textContent = 'Guardando horarios…';
    hoursStatus.className = 'status';
    try {
      await storeHoursSet(selectedSuper.id, hours);
      hoursStatus.textContent = 'Horarios actualizados.';
      hoursStatus.classList.add('success');
    } catch (error) {
      hoursStatus.textContent = error.message || 'No se pudieron guardar los horarios';
      hoursStatus.classList.add('error');
    }
  });

  loadList();
});

function createHoursInputs(container) {
  container.textContent = '';
  weekdays.forEach((weekday, index) => {
    const wrapper = document.createElement('div');
    wrapper.dataset.weekday = index;
    wrapper.innerHTML = `
      <label style="display:flex;flex-direction:column;gap:0.5rem;">
        <span>${weekday}</span>
        <div style="display:flex;gap:0.5rem;">
          <input type="time" name="open" aria-label="Hora de apertura ${weekday}" />
          <input type="time" name="close" aria-label="Hora de cierre ${weekday}" />
        </div>
      </label>
    `;
    container.appendChild(wrapper);
  });
}
