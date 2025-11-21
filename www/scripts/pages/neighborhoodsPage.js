import {
    currentUser,
    neighborhoodsList,
    neighborhoodCreate,
    neighborhoodUpdate,
    neighborhoodDelete,
} from '../apiClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const status = document.getElementById('page-status');
    const table = document.getElementById('neighborhood-table');
    const form = document.getElementById('neighborhood-form');
    const formStatus = document.getElementById('form-status');
    const deleteBtn = document.getElementById('delete-neighborhood');
    const filterCity = document.getElementById('filter-city');

    let selected = null;

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
        status.textContent = 'Sesión inválida o expirada.';
        status.classList.add('error');
        disablePage();
        return;
    }

    async function loadNeighborhoods() {
        table.innerHTML = '<tr><td colspan="3">Cargando…</td></tr>';
        try {
            const filters = { limit: 100 };
            if (filterCity.value) filters.city = filterCity.value;

            const data = await neighborhoodsList(filters);
            const items = data.items || data.results || [];
            if (!items.length) {
                table.innerHTML = '<tr><td colspan="3">Sin datos.</td></tr>';
                return;
            }
            table.innerHTML = '';
            items.forEach((item) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
          <td>${item.city}</td>
          <td>${item.name}</td>
          <td><button type="button" class="button ghost" data-id="${item.id}">Editar</button></td>
        `;
                tr.querySelector('button').addEventListener('click', () => select(item));
                table.appendChild(tr);
            });
        } catch (error) {
            table.innerHTML = `<tr><td colspan="3">${error.message}</td></tr>`;
        }
    }

    function select(item) {
        selected = item;
        form.elements['id'].value = item.id;
        form.elements['name'].value = item.name || '';
        form.elements['city'].value = item.city || 'Rio Segundo';
        formStatus.textContent = `Editando barrio #${item.id}`;
        formStatus.className = 'status';
    }

    function disablePage() {
        form?.querySelectorAll('input,select,button').forEach((el) => el.setAttribute('disabled', 'disabled'));
    }

    filterCity?.addEventListener('change', loadNeighborhoods);

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());
        formStatus.textContent = 'Guardando…';
        formStatus.className = 'status';
        try {
            if (payload.id) {
                await neighborhoodUpdate(Number(payload.id), payload);
                formStatus.textContent = 'Barrio actualizado.';
            } else {
                await neighborhoodCreate(payload);
                formStatus.textContent = 'Barrio creado.';
            }
            formStatus.classList.add('success');
            selected = null;
            form.reset();
            await loadNeighborhoods();
        } catch (error) {
            formStatus.textContent = error.message || 'No se pudo guardar';
            formStatus.classList.add('error');
        }
    });

    deleteBtn?.addEventListener('click', async () => {
        if (!selected?.id) {
            formStatus.textContent = 'Seleccioná un barrio primero.';
            formStatus.classList.add('error');
            return;
        }
        if (!window.confirm('¿Eliminar este barrio?')) return;
        formStatus.textContent = 'Eliminando…';
        formStatus.className = 'status';
        try {
            await neighborhoodDelete(selected.id);
            formStatus.textContent = 'Barrio eliminado.';
            formStatus.classList.add('success');
            selected = null;
            form.reset();
            await loadNeighborhoods();
        } catch (error) {
            formStatus.textContent = error.message || 'No se pudo eliminar';
            formStatus.classList.add('error');
        }
    });

    loadNeighborhoods();
});
