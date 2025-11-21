import {
    currentUser,
    brandsList,
    brandCreate,
    brandUpdate,
    brandDelete,
} from '../apiClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const status = document.getElementById('page-status');
    const table = document.getElementById('brand-table');
    const form = document.getElementById('brand-form');
    const formStatus = document.getElementById('brand-status');
    const deleteBtn = document.getElementById('delete-brand');

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

    async function loadBrands() {
        table.innerHTML = '<tr><td colspan="4">Cargando…</td></tr>';
        try {
            const data = await brandsList({ limit: 100 });
            const items = data.items || data.results || [];
            if (!items.length) {
                table.innerHTML = '<tr><td colspan="4">Sin datos.</td></tr>';
                return;
            }
            table.innerHTML = '';
            items.forEach((item) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
          <td>${item.id}</td>
          <td>${item.name}</td>
          <td>${item.slug}</td>
          <td><button type="button" class="button ghost" data-id="${item.id}">Editar</button></td>
        `;
                tr.querySelector('button').addEventListener('click', () => select(item));
                table.appendChild(tr);
            });
        } catch (error) {
            table.innerHTML = `<tr><td colspan="4">${error.message}</td></tr>`;
        }
    }

    function select(item) {
        selected = item;
        form.elements['id'].value = item.id;
        form.elements['name'].value = item.name || '';
        form.elements['slug'].value = item.slug || '';
        formStatus.textContent = `Editando marca #${item.id}`;
        formStatus.className = 'status';
    }

    function disablePage() {
        form?.querySelectorAll('input,textarea,button').forEach((el) => el.setAttribute('disabled', 'disabled'));
    }

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());
        formStatus.textContent = 'Guardando…';
        formStatus.className = 'status';
        try {
            if (payload.id) {
                await brandUpdate(Number(payload.id), payload);
                formStatus.textContent = 'Marca actualizada.';
            } else {
                await brandCreate(payload);
                formStatus.textContent = 'Marca creada.';
            }
            formStatus.classList.add('success');
            selected = null;
            form.reset();
            await loadBrands();
        } catch (error) {
            formStatus.textContent = error.message || 'No se pudo guardar';
            formStatus.classList.add('error');
        }
    });

    deleteBtn?.addEventListener('click', async () => {
        if (!selected?.id) {
            formStatus.textContent = 'Seleccioná una marca primero.';
            formStatus.classList.add('error');
            return;
        }
        if (!window.confirm('¿Eliminar esta marca?')) return;
        formStatus.textContent = 'Eliminando…';
        formStatus.className = 'status';
        try {
            await brandDelete(selected.id);
            formStatus.textContent = 'Marca eliminada.';
            formStatus.classList.add('success');
            selected = null;
            form.reset();
            await loadBrands();
        } catch (error) {
            formStatus.textContent = error.message || 'No se pudo eliminar';
            formStatus.classList.add('error');
        }
    });

    loadBrands();
});
