import {
    currentUser,
    pharmaciesList,
    pharmacyCreate,
    pharmacyUpdate,
    pharmacyDelete,
    neighborhoodsList,
} from '../apiClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const status = document.getElementById('page-status');
    const table = document.getElementById('pharmacies-table');
    const form = document.getElementById('pharmacy-form');
    const formStatus = document.getElementById('form-status');
    const deleteBtn = document.getElementById('delete-pharmacy');
    const filterCity = document.getElementById('filter-city');
    const filterDate = document.getElementById('filter-date');
    const applyFiltersBtn = document.getElementById('apply-filters');
    const clearFiltersBtn = document.getElementById('clear-filters');

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

    // Load neighborhoods for the selected city
    async function loadNeighborhoods(city) {
        const neighborhoodSelect = form.elements['neighborhood_id'];
        neighborhoodSelect.innerHTML = '<option value="">-- Seleccionar --</option>';

        if (!city) return;

        try {
            const data = await neighborhoodsList({ city, limit: 100 });
            const items = data.items || data.results || [];
            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.name;
                neighborhoodSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading neighborhoods', error);
        }
    }

    // Load neighborhoods when city changes
    form.elements['city']?.addEventListener('change', (e) => {
        loadNeighborhoods(e.target.value);
    });

    async function loadPharmacies() {
        table.innerHTML = '<tr><td colspan="9">Cargando…</td></tr>';
        try {
            const filters = { limit: 100 };
            if (filterCity.value) filters.city = filterCity.value;
            if (filterDate.value) filters.date = filterDate.value;

            const data = await pharmaciesList(filters);
            const items = data.items || data.results || [];
            if (!items.length) {
                table.innerHTML = '<tr><td colspan="9">Sin datos.</td></tr>';
                return;
            }
            table.innerHTML = '';
            items.forEach((item) => {
                const tr = document.createElement('tr');
                const mapLink = item.latitude && item.longitude
                    ? `<a href="https://www.google.com/maps?q=${item.latitude},${item.longitude}" target="_blank" class="button ghost" style="padding: 0.25rem 0.5rem; font-size: 0.85rem;">Ver mapa</a>`
                    : '-';

                tr.innerHTML = `
          <td>${item.date}</td>
          <td>${item.city}</td>
          <td>${item.name}</td>
          <td>${item.neighborhood_name || '-'}</td>
          <td>${item.address}</td>
          <td>${item.schedule}</td>
          <td>${item.phone || '-'}</td>
          <td>${mapLink}</td>
          <td><button type="button" class="button ghost" data-id="${item.id}">Editar</button></td>
        `;
                tr.querySelector('button[data-id]').addEventListener('click', () => select(item));
                table.appendChild(tr);
            });
        } catch (error) {
            table.innerHTML = `<tr><td colspan="9">${error.message}</td></tr>`;
        }
    }

    async function select(item) {
        selected = item;
        form.elements['id'].value = item.id;
        form.elements['city'].value = item.city || 'Rio Segundo';
        form.elements['date'].value = item.date || '';
        form.elements['name'].value = item.name || '';

        // Load neighborhoods for the city, then set the value
        await loadNeighborhoods(item.city);
        form.elements['neighborhood_id'].value = item.neighborhood_id || '';

        form.elements['address'].value = item.address || '';
        form.elements['schedule'].value = item.schedule || '';
        form.elements['phone'].value = item.phone || '';
        form.elements['latitude'].value = item.latitude || '';
        form.elements['longitude'].value = item.longitude || '';
        formStatus.textContent = `Editando farmacia #${item.id}`;
        formStatus.className = 'status';
    }

    function disablePage() {
        form?.querySelectorAll('input,select,button').forEach((el) => el.setAttribute('disabled', 'disabled'));
    }

    applyFiltersBtn?.addEventListener('click', loadPharmacies);

    clearFiltersBtn?.addEventListener('click', () => {
        filterCity.value = '';
        filterDate.value = '';
        loadPharmacies();
    });

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        // Convert numeric fields
        if (payload.neighborhood_id) payload.neighborhood_id = parseInt(payload.neighborhood_id) || null;
        if (payload.latitude) payload.latitude = parseFloat(payload.latitude);
        if (payload.longitude) payload.longitude = parseFloat(payload.longitude);

        formStatus.textContent = 'Guardando…';
        formStatus.className = 'status';
        try {
            if (payload.id) {
                await pharmacyUpdate(Number(payload.id), payload);
                formStatus.textContent = 'Farmacia actualizada.';
            } else {
                await pharmacyCreate(payload);
                formStatus.textContent = 'Farmacia creada.';
            }
            formStatus.classList.add('success');
            selected = null;
            form.reset();
            await loadPharmacies();
        } catch (error) {
            formStatus.textContent = error.message || 'No se pudo guardar';
            formStatus.classList.add('error');
        }
    });

    deleteBtn?.addEventListener('click', async () => {
        if (!selected?.id) {
            formStatus.textContent = 'Seleccioná una farmacia primero.';
            formStatus.classList.add('error');
            return;
        }
        if (!window.confirm('¿Eliminar esta farmacia?')) return;
        formStatus.textContent = 'Eliminando…';
        formStatus.className = 'status';
        try {
            await pharmacyDelete(selected.id);
            formStatus.textContent = 'Farmacia eliminada.';
            formStatus.classList.add('success');
            selected = null;
            form.reset();
            await loadPharmacies();
        } catch (error) {
            formStatus.textContent = error.message || 'No se pudo eliminar';
            formStatus.classList.add('error');
        }
    });

    // Load neighborhoods for the initial city value
    const initialCity = form.elements['city']?.value;
    if (initialCity) {
        loadNeighborhoods(initialCity);
    }

    loadPharmacies();
});
