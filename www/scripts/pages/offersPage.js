import {
    offersList,
    offersUpload,
    offerGet,
    offerProcess,
    offerUpdateStatus,
    offerDelete,
    productCreateQuick,
    priceCreate,
    supermarketsList,
    productsList,
    promoTypesList
} from '../apiClient.js';

document.addEventListener('DOMContentLoaded', () => {
    initOffersPage();
});

const UPLOADS_BASE = 'https://anagramdev.com/apps/xanaeslab/';

// State variables
let currentOfferId = null;
let allProducts = [];
let allPromoTypes = [];

async function initOffersPage() {
    loadSupermarkets();
    loadOffers();

    // Event Listeners
    document.getElementById('btn-new-offer').addEventListener('click', () => {
        document.getElementById('upload-modal').showModal();
    });

    document.getElementById('upload-form').addEventListener('submit', handleUpload);
    document.getElementById('filter-status').addEventListener('change', loadOffers);

    document.getElementById('btn-close-review').addEventListener('click', closeReviewInterface);
    document.getElementById('btn-finish-review').addEventListener('click', finishReview);
}

async function loadSupermarkets() {
    try {
        const response = await supermarketsList();
        const select = document.getElementById('upload-supermarket');
        select.innerHTML = '<option value="">Seleccionar Supermercado</option>';
        response.items.forEach(s => {
            const option = document.createElement('option');
            option.value = s.id;
            option.textContent = s.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading supermarkets:', error);
    }
}

async function loadOffers() {
    const grid = document.getElementById('offers-grid');
    const status = document.getElementById('filter-status').value;

    grid.innerHTML = '<p>Cargando...</p>';

    try {
        const response = await offersList({ status });
        grid.innerHTML = '';

        if (response.items.length === 0) {
            grid.innerHTML = '<p>No hay ofertas registradas.</p>';
            return;
        }

        response.items.forEach(offer => {
            const card = createOfferCard(offer);
            grid.appendChild(card);
        });
    } catch (error) {
        grid.innerHTML = `<p class="error">Error al cargar ofertas: ${error.message}</p>`;
    }
}

function createOfferCard(offer) {
    const div = document.createElement('div');
    div.className = 'offer-card';

    const date = new Date(offer.uploaded_at).toLocaleDateString();
    const statusClass = `status-${offer.status}`;
    const statusLabels = {
        'pending': 'Pendiente',
        'processing': 'Procesando',
        'ready': 'Listo para Revisar',
        'completed': 'Completado',
        'error': 'Error'
    };

    div.innerHTML = `
        <button class="btn-delete-offer" data-id="${offer.id}" title="Eliminar oferta">&times;</button>
        <img src="${UPLOADS_BASE}${offer.image_path}" alt="Oferta ${offer.supermarket_name}">
        <h3>${offer.supermarket_name}</h3>
        <p>Subido el: ${date}</p>
        <p><span class="status-badge ${statusClass}">${statusLabels[offer.status] || offer.status}</span></p>
        ${offer.status === 'ready' || offer.status === 'completed' ?
            `<button class="btn btn-primary btn-sm btn-review" data-id="${offer.id}">Revisar</button>` : ''}
        ${offer.status === 'pending' ?
            `<button class="btn btn-secondary btn-sm btn-process" data-id="${offer.id}">Procesar Ahora</button>` : ''}
        ${offer.status === 'error' ? `<p class="error-text">${offer.error_message}</p>` : ''}
    `;

    const deleteBtn = div.querySelector('.btn-delete-offer');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (confirm('¿Estás seguro de que deseas eliminar esta oferta? Esta acción no se puede deshacer.')) {
                try {
                    await offerDelete(offer.id);
                    loadOffers();
                } catch (e) {
                    alert('Error al eliminar: ' + e.message);
                }
            }
        });
    }

    const reviewBtn = div.querySelector('.btn-review');
    if (reviewBtn) {
        reviewBtn.addEventListener('click', () => openReviewInterface(offer.id));
    }

    const processBtn = div.querySelector('.btn-process');
    if (processBtn) {
        processBtn.addEventListener('click', async () => {
            if (confirm('¿Iniciar procesamiento?')) {
                try {
                    await offerProcess(offer.id);
                    loadOffers();
                } catch (e) {
                    alert(e.message);
                }
            }
        });
    }

    return div;
}

async function handleUpload(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const submitBtn = form.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Subiendo...';

    try {
        await offersUpload(formData);
        document.getElementById('upload-modal').close();
        form.reset();
        loadOffers();
        alert('Oferta subida correctamente.');
    } catch (error) {
        alert('Error al subir: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Subir y Procesar';
    }
}

// --- Review Interface Logic ---

async function openReviewInterface(offerId) {
    currentOfferId = offerId;
    const ui = document.getElementById('review-interface');
    const img = document.getElementById('review-image');
    const list = document.getElementById('parsed-items-list');

    ui.style.display = 'block';
    list.innerHTML = '<p>Cargando detalles...</p>';

    try {
        // Load dependencies if not loaded
        if (allProducts.length === 0) {
            const pRes = await productsList({ limit: 1000 }); // Get all products
            allProducts = pRes.items;
        }
        if (allPromoTypes.length === 0) {
            const ptRes = await promoTypesList();
            allPromoTypes = ptRes.items;
        }

        const data = await offerGet(offerId);
        const offer = data.offer;

        img.src = UPLOADS_BASE + offer.image_path;
        document.getElementById('review-supermarket').textContent = offer.supermarket_name;
        document.getElementById('review-status').textContent = offer.status;

        renderParsedItems(data.parsed_items, offer.supermarket_id);

    } catch (error) {
        alert('Error al cargar detalles: ' + error.message);
        closeReviewInterface();
    }
}

function closeReviewInterface() {
    document.getElementById('review-interface').style.display = 'none';
    currentOfferId = null;
    loadOffers(); // Refresh list
}

function renderParsedItems(items, supermarketId) {
    const container = document.getElementById('parsed-items-list');
    container.innerHTML = '';

    if (items.length === 0) {
        container.innerHTML = '<p>No se detectaron items en esta oferta.</p>';
        return;
    }

    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'parsed-item';
        div.id = `item-${index}`;

        // Try to find matching product
        const match = allProducts.find(p =>
            p.name.toLowerCase().includes(item.product_name.toLowerCase()) ||
            item.product_name.toLowerCase().includes(p.name.toLowerCase())
        );
        const selectedProductId = match ? match.id : '';

        div.innerHTML = `
            <h4>${item.product_name} <small>(Confianza: ${item.confidence_score})</small></h4>
            <form class="item-form" data-index="${index}">
                <input type="hidden" name="supermarket_id" value="${supermarketId}">
                
                <div style="display: flex; gap: 10px; align-items: flex-end;">
                    <label style="flex: 3;">
                        Producto (Sistema)
                        <select name="product_id" required class="product-select">
                            <option value="">Seleccionar Producto...</option>
                            ${allProducts.map(p => `
                                <option value="${p.id}" ${p.id == selectedProductId ? 'selected' : ''}>
                                    ${p.name} - ${p.brand} (${p.size})
                                </option>
                            `).join('')}
                        </select>
                    </label>
                    <button type="button" class="btn btn-secondary btn-sm btn-quick-add" 
                        data-name="${item.product_name}" 
                        style="margin-bottom: 15px;"
                        title="Crear nuevo producto si no existe">
                        + Nuevo
                    </button>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <label style="flex: 1;">
                        Precio
                        <input type="number" name="price" step="0.01" value="${item.price}" required>
                    </label>
                    <label style="flex: 1;">
                        Moneda
                        <select name="currency">
                            <option value="ARS" ${item.currency === 'ARS' ? 'selected' : ''}>ARS</option>
                            <option value="USD" ${item.currency === 'USD' ? 'selected' : ''}>USD</option>
                        </select>
                    </label>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <label style="flex: 1;">
                        Desde
                        <input type="date" name="valid_from" value="${item.valid_from}" required>
                    </label>
                    <label style="flex: 1;">
                        Hasta
                        <input type="date" name="valid_to" value="${item.valid_to || ''}">
                    </label>
                </div>
                
                <label>
                    Promoción
                    <select name="promo_type_id">
                        <option value="">Sin promoción</option>
                        ${allPromoTypes.map(pt => `
                            <option value="${pt.id}" ${pt.id == item.promo_type_id ? 'selected' : ''}>
                                ${pt.name}
                            </option>
                        `).join('')}
                    </select>
                </label>
                <label>
                    Restricciones
                    <textarea name="restrictions" rows="2" 
                        placeholder="Ej: No incluye moñitos ni coditos">${item.restrictions || ''}</textarea>
                </label>
                <button type="submit" class="btn btn-primary btn-sm" style="margin-top: 10px;">Confirmar y Crear Precio</button>
            </form>
        `;

        div.querySelector('form').addEventListener('submit', handleItemConfirm);

        // Quick Add Button Logic
        const qaBtn = div.querySelector('.btn-quick-add');
        if (qaBtn) {
            qaBtn.addEventListener('click', () => openQuickAddModal(item.product_name, index));
        }

        container.appendChild(div);
    });
}

// --- Quick Add Logic ---
let quickAddTargetIndex = null;

function openQuickAddModal(productName, index) {
    quickAddTargetIndex = index;
    const modal = document.getElementById('quick-add-modal');
    const form = document.getElementById('quick-add-form');

    // Reset and fill
    form.reset();
    document.getElementById('qa-name').value = productName;

    // Populate categories datalist if empty
    const datalist = document.getElementById('categories-list');
    if (datalist.options.length === 0) {
        // We need to fetch categories first? 
        // For now let's assume we might need a way to get them or just let user type.
        // Ideally we should have loaded categories. 
        // Let's try to extract unique categories from allProducts if available, 
        // or we might need a categoriesList endpoint. 
        // For simplicity, we'll skip pre-filling datalist for now or use what we have.
    }

    modal.showModal();

    // Handle submit
    form.onsubmit = handleQuickAddSubmit;
}

async function handleQuickAddSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    btn.disabled = true;
    btn.textContent = 'Creando...';

    try {
        const result = await productCreateQuick(data);

        // Add to local list
        const newProduct = {
            id: result.id,
            name: result.name,
            brand: data.brand || '',
            size: data.size || ''
        };
        allProducts.push(newProduct);

        // Update ALL dropdowns
        document.querySelectorAll('.product-select').forEach(select => {
            const option = document.createElement('option');
            option.value = newProduct.id;
            option.textContent = `${newProduct.name} - ${newProduct.brand} (${newProduct.size})`;
            select.appendChild(option);
        });

        // Select in the target row
        if (quickAddTargetIndex !== null) {
            const targetRow = document.getElementById(`item-${quickAddTargetIndex}`);
            const select = targetRow.querySelector('.product-select');
            select.value = newProduct.id;

            // Flash effect
            select.style.backgroundColor = '#d4edda';
            setTimeout(() => select.style.backgroundColor = '', 1000);
        }

        document.getElementById('quick-add-modal').close();
        alert('Producto creado exitosamente.');

    } catch (error) {
        alert('Error al crear producto: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Crear y Seleccionar';
    }
}

async function handleItemConfirm(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');

    // Convert FormData to object
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Fix types
    data.supermarket_id = parseInt(data.supermarket_id);
    data.product_id = parseInt(data.product_id);
    data.price = parseFloat(data.price);
    if (data.promo_type_id) data.promo_type_id = parseInt(data.promo_type_id);
    else delete data.promo_type_id;

    if (!data.valid_to) delete data.valid_to;

    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        await priceCreate(data);

        // Mark visual feedback
        form.closest('.parsed-item').classList.add('confirmed');
        btn.textContent = 'Guardado ✓';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-success');

        // Optional: Disable form inputs
        Array.from(form.elements).forEach(el => el.disabled = true);

    } catch (error) {
        alert('Error al crear precio: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Confirmar y Crear Precio';
    }
}

async function finishReview() {
    if (!currentOfferId) return;

    if (!confirm('¿Estás seguro de que deseas finalizar la revisión? Esto marcará la oferta como completada.')) {
        return;
    }

    try {
        await offerUpdateStatus(currentOfferId, 'completed');
        alert('Revisión finalizada.');
        closeReviewInterface();
    } catch (error) {
        alert('Error al finalizar: ' + error.message);
    }
}
