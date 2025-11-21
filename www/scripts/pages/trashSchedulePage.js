import {
    currentUser,
    neighborhoodsList,
    schedulesList,
    scheduleCreate,
    scheduleDelete,
} from '../apiClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const status = document.getElementById('page-status');
    const citySelect = document.getElementById('city-select');
    const neighborhoodSelect = document.getElementById('neighborhood-select');
    const scheduleSection = document.getElementById('schedule-section');
    const table = document.getElementById('schedule-table');
    const form = document.getElementById('schedule-form');
    const formStatus = document.getElementById('schedule-status');

    let currentNeighborhoodId = null;

    try {
        const user = await currentUser();
        if (user?.role !== 'admin') {
            status.textContent = 'Acceso restringido. Iniciá sesión como administrador.';
            status.classList.add('error');
            return;
        }
        status.textContent = 'Sesión validada.';
        status.classList.add('success');
    } catch (error) {
        status.textContent = 'Sesión inválida o expirada.';
        status.classList.add('error');
        return;
    }

    async function loadNeighborhoods() {
        neighborhoodSelect.innerHTML = '<option value="">Cargando...</option>';
        neighborhoodSelect.disabled = true;
        try {
            const city = citySelect.value;
            const data = await neighborhoodsList({ city, limit: 100 });
            const items = data.items || data.results || [];

            neighborhoodSelect.innerHTML = '<option value="">-- Seleccionar --</option>';
            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.name;
                neighborhoodSelect.appendChild(option);
            });
            neighborhoodSelect.disabled = false;
        } catch (error) {
            neighborhoodSelect.innerHTML = '<option value="">Error al cargar</option>';
        }
    }

    async function loadSchedules() {
        if (!currentNeighborhoodId) return;
        table.innerHTML = '<tr><td colspan="3">Cargando…</td></tr>';
        try {
            const data = await schedulesList(currentNeighborhoodId);
            const items = data.schedules || [];

            if (!items.length) {
                table.innerHTML = '<tr><td colspan="3">Sin horarios asignados.</td></tr>';
                return;
            }

            table.innerHTML = '';
            items.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
          <td>${item.day_of_week}</td>
          <td>${item.type}</td>
          <td><button type="button" class="button secondary small" data-id="${item.id}">Quitar</button></td>
        `;
                tr.querySelector('button').addEventListener('click', () => removeSchedule(item.id));
                table.appendChild(tr);
            });
        } catch (error) {
            table.innerHTML = `<tr><td colspan="3">${error.message}</td></tr>`;
        }
    }

    async function removeSchedule(id) {
        if (!confirm('¿Quitar este horario?')) return;
        try {
            await scheduleDelete(id);
            await loadSchedules();
        } catch (error) {
            alert(error.message || 'Error al eliminar');
        }
    }

    citySelect.addEventListener('change', () => {
        scheduleSection.style.display = 'none';
        currentNeighborhoodId = null;
        loadNeighborhoods();
    });

    neighborhoodSelect.addEventListener('change', () => {
        const id = neighborhoodSelect.value;
        if (id) {
            currentNeighborhoodId = id;
            scheduleSection.style.display = 'block';
            loadSchedules();
        } else {
            scheduleSection.style.display = 'none';
            currentNeighborhoodId = null;
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!currentNeighborhoodId) return;

        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());
        payload.neighborhood_id = Number(currentNeighborhoodId);

        formStatus.textContent = 'Guardando...';
        formStatus.className = 'status';

        try {
            await scheduleCreate(payload);
            formStatus.textContent = 'Horario agregado.';
            formStatus.classList.add('success');
            await loadSchedules();
        } catch (error) {
            formStatus.textContent = error.message || 'Error al guardar';
            formStatus.classList.add('error');
        }
    });

    // Initial load
    loadNeighborhoods();
});
