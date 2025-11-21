import {
    currentUser,
    neighborhoodsList,
    pharmacyCatalogList,
    pharmacyCatalogCreate,
    pharmacyCatalogUpdate,
    pharmacyCatalogDelete,
    pharmaciesList,
    pharmacyCreate,
    pharmacyUpdate,
    pharmacyDelete,
    pharmacyBulkCreate,
    pharmacyGetByDate,
    pharmacyGetMonth,
} from '../apiClient.js';

let currentCity = '';
let neighborhoods = [];
let pharmacyCatalog = [];

// ==================== INITIALIZATION ====================
async function init() {
    const user = await currentUser();
    if (!user || user.role !== 'admin') {
        window.location.href = 'admin-login.html';
        return;
    }

    await loadNeighborhoods();
    setupTabs();
    setupCatalogHandlers();
    setupMonthlyHandlers();
    setupIndividualHandlers();
    setupQueryHandlers();

    loadCatalogTable();
}

// ==================== NEIGHBORHOODS ====================
async function loadNeighborhoods() {
    try {
        const result = await neighborhoodsList({});
        neighborhoods = result.items || [];
    } catch (error) {
        console.error('Error loading neighborhoods:', error);
    }
}

function populateNeighborhoodSelect(selectId, city) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Sin barrio</option>';

    const filtered = neighborhoods.filter(n => n.city === city);
    filtered.forEach(n => {
        const option = document.createElement('option');
        option.value = n.id;
        option.textContent = n.name;
        select.appendChild(option);
    });
}

// ==================== TABS ====================
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
        });
    });
}

// ==================== CATALOG TAB ====================
function setupCatalogHandlers() {
    document.getElementById('catalog-filter-btn').addEventListener('click', loadCatalogTable);
    document.getElementById('catalog-add-btn').addEventListener('click', () => openCatalogModal());
    document.getElementById('catalog-form').addEventListener('submit', handleCatalogSubmit);
    document.getElementById('catalog-cancel-btn').addEventListener('click', closeCatalogModal);
    document.getElementById('catalog-city').addEventListener('change', (e) => {
        populateNeighborhoodSelect('catalog-neighborhood', e.target.value);
    });
}

async function loadCatalogTable() {
    const city = document.getElementById('catalog-city-filter').value;
    const tbody = document.querySelector('#catalog-table tbody');
    tbody.innerHTML = '<tr><td colspan="7">Cargando...</td></tr>';

    try {
        const params = city ? { city } : {};
        const result = await pharmacyCatalogList(params);
        pharmacyCatalog = result.items || [];

        if (pharmacyCatalog.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">No hay farmacias registradas</td></tr>';
            return;
        }

        tbody.innerHTML = pharmacyCatalog.map(p => `
      <tr>
        <td>${p.id}</td>
        <td>${p.city}</td>
        <td>${p.name}</td>
        <td>${p.neighborhood_name || '-'}</td>
        <td>${p.address}</td>
        <td>${p.phone || '-'}</td>
        <td>
          <button class="btn-sm btn-primary" onclick="window.editCatalogItem(${p.id})">Editar</button>
          <button class="btn-sm btn-danger" onclick="window.deleteCatalogItem(${p.id})">Eliminar</button>
        </td>
      </tr>
    `).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="7" style="color: red;">Error: ${error.message}</td></tr>`;
    }
}

function openCatalogModal(pharmacy = null) {
    const modal = document.getElementById('catalog-modal');
    const title = document.getElementById('catalog-modal-title');
    const form = document.getElementById('catalog-form');

    form.reset();

    if (pharmacy) {
        title.textContent = 'Editar Farmacia';
        document.getElementById('catalog-id').value = pharmacy.id;
        document.getElementById('catalog-city').value = pharmacy.city;
        document.getElementById('catalog-name').value = pharmacy.name;
        document.getElementById('catalog-address').value = pharmacy.address;
        document.getElementById('catalog-phone').value = pharmacy.phone || '';
        document.getElementById('catalog-latitude').value = pharmacy.latitude || '';
        document.getElementById('catalog-longitude').value = pharmacy.longitude || '';

        populateNeighborhoodSelect('catalog-neighborhood', pharmacy.city);
        document.getElementById('catalog-neighborhood').value = pharmacy.neighborhood_id || '';
    } else {
        title.textContent = 'Nueva Farmacia';
        document.getElementById('catalog-id').value = '';
    }

    modal.style.display = 'block';
}

function closeCatalogModal() {
    document.getElementById('catalog-modal').style.display = 'none';
}

async function handleCatalogSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('catalog-id').value;
    const payload = {
        city: document.getElementById('catalog-city').value,
        name: document.getElementById('catalog-name').value,
        neighborhood_id: document.getElementById('catalog-neighborhood').value || null,
        address: document.getElementById('catalog-address').value,
        phone: document.getElementById('catalog-phone').value || null,
        latitude: document.getElementById('catalog-latitude').value || null,
        longitude: document.getElementById('catalog-longitude').value || null,
    };

    try {
        if (id) {
            await pharmacyCatalogUpdate(parseInt(id), payload);
            alert('Farmacia actualizada exitosamente');
        } else {
            await pharmacyCatalogCreate(payload);
            alert('Farmacia creada exitosamente');
        }
        closeCatalogModal();
        loadCatalogTable();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

window.editCatalogItem = (id) => {
    const pharmacy = pharmacyCatalog.find(p => p.id === id);
    if (pharmacy) openCatalogModal(pharmacy);
};

window.deleteCatalogItem = async (id) => {
    const pharmacy = pharmacyCatalog.find(p => p.id === id);
    if (!confirm(`¿Eliminar la farmacia "${pharmacy.name}"?`)) return;

    try {
        await pharmacyCatalogDelete(id);
        alert('Farmacia eliminada exitosamente');
        loadCatalogTable();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
};

// ==================== MONTHLY TAB ====================
function setupMonthlyHandlers() {
    const currentYear = new Date().getFullYear();
    document.getElementById('monthly-year').value = currentYear;

    document.getElementById('monthly-generate-btn').addEventListener('click', generateMonthlyForm);
    document.getElementById('monthly-save-btn').addEventListener('click', saveMonthlyData);
    document.getElementById('monthly-cancel-btn').addEventListener('click', () => {
        document.getElementById('monthly-form-container').style.display = 'none';
    });
}

async function generateMonthlyForm() {
    const city = document.getElementById('monthly-city').value;
    const year = parseInt(document.getElementById('monthly-year').value);
    const month = parseInt(document.getElementById('monthly-month').value);

    if (!city || !year || !month) {
        alert('Por favor complete todos los campos');
        return;
    }

    // Load pharmacies for this city
    try {
        const result = await pharmacyCatalogList({ city });
        const pharmacies = result.items || [];

        if (pharmacies.length === 0) {
            alert(`No hay farmacias registradas para ${city}. Por favor agregue farmacias primero en la pestaña "Catálogo".`);
            return;
        }

        const daysInMonth = new Date(year, month, 0).getDate();
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        document.getElementById('monthly-form-title').textContent = `${monthNames[month - 1]} ${year} - ${city}`;

        const grid = document.getElementById('monthly-days-grid');
        grid.innerHTML = '';

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            const dayName = date.toLocaleDateString('es-AR', { weekday: 'short' });

            const card = document.createElement('div');
            card.className = 'day-card';
            card.innerHTML = `
        <h4>Día ${day} (${dayName})</h4>
        <label>Farmacia:</label>
        <select class="monthly-pharmacy" data-day="${day}" required>
          <option value="">Seleccione...</option>
          ${pharmacies.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
        <label style="margin-top: 10px;">Horario:</label>
        <input type="text" class="monthly-schedule" data-day="${day}" value="08:00 - 08:00" required>
      `;
            grid.appendChild(card);
        }

        document.getElementById('monthly-form-container').style.display = 'block';
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function saveMonthlyData() {
    const city = document.getElementById('monthly-city').value;
    const year = parseInt(document.getElementById('monthly-year').value);
    const month = parseInt(document.getElementById('monthly-month').value);

    const pharmacySelects = document.querySelectorAll('.monthly-pharmacy');
    const scheduleInputs = document.querySelectorAll('.monthly-schedule');

    const duties = [];
    for (let i = 0; i < pharmacySelects.length; i++) {
        const pharmacyId = pharmacySelects[i].value;
        const schedule = scheduleInputs[i].value;

        if (!pharmacyId || !schedule) {
            alert(`Por favor complete todos los campos del día ${i + 1}`);
            return;
        }

        duties.push({
            pharmacy_id: parseInt(pharmacyId),
            schedule: schedule.trim(),
        });
    }

    const payload = { city, year, month, duties };

    // Check if data exists
    try {
        const existing = await pharmacyGetMonth(city, year, month);
        if (existing.loaded_days > 0) {
            if (!confirm(`Ya existen ${existing.loaded_days} turnos cargados para este mes. ¿Desea sobrescribirlos?`)) {
                return;
            }
            payload.overwrite = true;
        }
    } catch (error) {
        // Month doesn't exist, continue
    }

    try {
        await pharmacyBulkCreate(payload);
        alert('Mes cargado exitosamente');
        document.getElementById('monthly-form-container').style.display = 'none';
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// ==================== INDIVIDUAL TAB ====================
function setupIndividualHandlers() {
    document.getElementById('individual-filter-btn').addEventListener('click', loadIndividualTable);
}

async function loadIndividualTable() {
    const city = document.getElementById('individual-city-filter').value;
    const dateFrom = document.getElementById('individual-date-from').value;
    const dateTo = document.getElementById('individual-date-to').value;

    const tbody = document.querySelector('#individual-table tbody');
    tbody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';

    try {
        const params = {};
        if (city) params.city = city;
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;

        const result = await pharmaciesList(params);
        const duties = result.items || [];

        if (duties.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No hay turnos registrados</td></tr>';
            return;
        }

        tbody.innerHTML = duties.map(d => `
      <tr>
        <td>${d.id}</td>
        <td>${d.city}</td>
        <td>${d.date}</td>
        <td>${d.pharmacy_name || 'N/A'}</td>
        <td>${d.schedule}</td>
        <td>
          <button class="btn-sm btn-danger" onclick="window.deleteIndividualDuty(${d.id})">Eliminar</button>
        </td>
      </tr>
    `).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="color: red;">Error: ${error.message}</td></tr>`;
    }
}

window.deleteIndividualDuty = async (id) => {
    if (!confirm('¿Eliminar este turno?')) return;

    try {
        await pharmacyDelete(id);
        alert('Turno eliminado exitosamente');
        loadIndividualTable();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
};

// ==================== QUERY TAB ====================
function setupQueryHandlers() {
    document.getElementById('query-search-btn').addEventListener('click', searchPharmacy);
}

async function searchPharmacy() {
    const city = document.getElementById('query-city').value;
    const date = document.getElementById('query-date').value;

    if (!city) {
        alert('Por favor seleccione una ciudad');
        return;
    }

    const resultDiv = document.getElementById('query-result');
    const contentDiv = document.getElementById('query-result-content');

    try {
        const result = await pharmacyGetByDate(city, date || null);
        const pharmacy = result.pharmacy;

        contentDiv.innerHTML = `
      <p><strong>Fecha:</strong> ${pharmacy.date}</p>
      <p><strong>Farmacia:</strong> ${pharmacy.pharmacy_name}</p>
      <p><strong>Dirección:</strong> ${pharmacy.address}</p>
      <p><strong>Barrio:</strong> ${pharmacy.neighborhood_name || 'N/A'}</p>
      <p><strong>Horario:</strong> ${pharmacy.schedule}</p>
      <p><strong>Teléfono:</strong> ${pharmacy.phone || 'N/A'}</p>
    `;

        resultDiv.style.display = 'block';
    } catch (error) {
        contentDiv.innerHTML = `<p style="color: red;">${error.message}</p>`;
        resultDiv.style.display = 'block';
    }
}

// ==================== START ====================
init();
