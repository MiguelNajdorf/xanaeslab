import { createAdminLogin } from '../scripts/ui/adminLogin.js';
import { createImportPreview } from '../scripts/ui/importPreview.js';
import {
  fetchOfertasPorCiudad,
  fetchSupermercados,
  saveSupermercado,
  deleteSupermercado,
  listarImportaciones,
  deleteOfertas,
  getPreferences,
  setPreference,
  upsertAjuste,
} from '../scripts/store.js';
import { formatCurrency, formatDateISO } from '../scripts/format.js';

const app = document.getElementById('admin-app');
const navButtons = document.querySelectorAll('.admin-nav button');

let currentTab = 'login';
let session = restoreSession();

navButtons.forEach(button => {
  button.addEventListener('click', () => {
    currentTab = button.dataset.tab;
    updateNav();
    renderTab();
  });
});

updateNav();
renderTab();

function renderTab() {
  switch (currentTab) {
    case 'login':
      renderLogin();
      break;
    case 'importar':
      renderImportar();
      break;
    case 'ofertas':
      renderOfertas();
      break;
    case 'historial':
      renderHistorial();
      break;
    case 'supermercados':
      renderSupermercados();
      break;
    case 'ajustes':
      renderAjustes();
      break;
    default:
      renderLogin();
  }
}

function renderLogin() {
  app.textContent = '';
  const login = createAdminLogin({
    onSuccess({ email }) {
      session = { email, validUntil: Date.now() + 10 * 60 * 1000 };
      currentTab = 'importar';
      updateNav();
      renderTab();
    }
  });
  app.appendChild(login);
  const note = document.createElement('p');
  note.textContent = 'El OTP se genera en la consola del navegador en esta versión. Integrar servicio SMTP/API aquí en el futuro.';
  app.appendChild(note);
}

function requireAuth() {
  if (!session || session.validUntil < Date.now()) {
    app.textContent = '';
    const warning = document.createElement('section');
    warning.className = 'panel';
    warning.innerHTML = '<h2>Sesión requerida</h2><p>Iniciá sesión con OTP válido para acceder a esta sección.</p>';
    app.appendChild(warning);
    return false;
  }
  return true;
}

function renderImportar() {
  app.textContent = '';
  if (!requireAuth()) return;
  const panel = document.createElement('div');
  panel.className = 'panel';
  const view = createImportPreview({
    onFinished(resumen) {
      const info = document.createElement('p');
      info.textContent = `Resumen: ${resumen.ok} OK · ${resumen.dup} duplicadas · ${resumen.err} con errores`;
      panel.appendChild(info);
    }
  });
  panel.appendChild(view);
  app.appendChild(panel);
}

async function renderOfertas() {
  app.textContent = '';
  if (!requireAuth()) return;
  const panel = document.createElement('section');
  panel.className = 'panel';
  const title = document.createElement('h2');
  title.textContent = 'Ofertas cargadas';
  panel.appendChild(title);

  const filtros = document.createElement('div');
  filtros.className = 'actions-inline';
  const selectCiudad = document.createElement('select');
  ['','Rio Segundo','Pilar'].forEach(ciudad => {
    const option = document.createElement('option');
    option.value = ciudad;
    option.textContent = ciudad ? ciudad : 'Todas las ciudades';
    selectCiudad.appendChild(option);
  });
  filtros.appendChild(selectCiudad);

  const selectSuper = document.createElement('select');
  selectSuper.innerHTML = '<option value="">Todos los supermercados</option>';
  filtros.appendChild(selectSuper);

  const inputVigencia = document.createElement('input');
  inputVigencia.type = 'date';
  inputVigencia.placeholder = 'Vigencia hasta';
  filtros.appendChild(inputVigencia);

  const btnEliminar = document.createElement('button');
  btnEliminar.className = 'button secondary';
  btnEliminar.type = 'button';
  btnEliminar.textContent = 'Eliminar lote';
  filtros.appendChild(btnEliminar);
  panel.appendChild(filtros);

  const tabla = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Producto</th><th>Supermercado</th><th>Ciudad</th><th>Precio</th><th>Vigencia</th><th>Promo</th></tr>';
  const tbody = document.createElement('tbody');
  tabla.append(thead, tbody);
  panel.appendChild(tabla);
  app.appendChild(panel);

  selectCiudad.addEventListener('change', cargar);
  inputVigencia.addEventListener('change', cargar);
  btnEliminar.addEventListener('click', async () => {
    const ciudad = selectCiudad.value;
    const hasta = inputVigencia.value;
    const superId = selectSuper.value;
    await deleteOfertas(oferta => {
      if (ciudad && oferta.ciudad !== ciudad) return false;
      if (superId && String(oferta.supermercado_id) !== superId) return false;
      if (hasta && new Date(oferta.vigencia_hasta) > new Date(hasta)) return false;
      return true;
    });
    await cargar();
  });

  async function cargar() {
    tbody.textContent = '';
    selectSuper.innerHTML = '<option value="">Todos los supermercados</option>';
    const ciudades = selectCiudad.value ? [selectCiudad.value] : ['Rio Segundo', 'Pilar'];
    const ofertas = [];
    const superMap = new Map();
    for (const ciudadSel of ciudades) {
      const dataOfertas = await fetchOfertasPorCiudad(ciudadSel);
      ofertas.push(...dataOfertas);
      const dataSupers = await fetchSupermercados(ciudadSel);
      dataSupers.forEach(supermercado => superMap.set(supermercado.id, supermercado));
    }
    Array.from(superMap.values()).forEach(supermercado => {
      const option = document.createElement('option');
      option.value = supermercado.id;
      option.textContent = `${supermercado.nombre} (${supermercado.ciudad})`;
      selectSuper.appendChild(option);
    });
    const filtradas = ofertas
      .filter(oferta => {
        if (selectCiudad.value && oferta.ciudad !== selectCiudad.value) return false;
        if (inputVigencia.value && new Date(oferta.vigencia_hasta) > new Date(inputVigencia.value)) return false;
        if (selectSuper.value && oferta.supermercado_id !== Number(selectSuper.value)) return false;
        return true;
      })
      .slice(0, 200);
    filtradas.forEach(oferta => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${oferta.producto}</td><td>${oferta.supermercado}</td><td>${oferta.ciudad}</td><td>${formatCurrency(oferta.precio_individual)}</td><td>${formatDateISO(oferta.vigencia_desde)} - ${formatDateISO(oferta.vigencia_hasta)}</td><td>${oferta.promo_tipo}</td>`;
      tbody.appendChild(tr);
    });
  }

  await cargar();
}

async function renderHistorial() {
  app.textContent = '';
  if (!requireAuth()) return;
  const panel = document.createElement('section');
  panel.className = 'panel';
  const title = document.createElement('h2');
  title.textContent = 'Historial de importaciones';
  panel.appendChild(title);
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Fecha</th><th>Archivos</th><th>OK</th><th>Duplicadas</th><th>Errores</th><th>Notas</th></tr></thead>';
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  panel.appendChild(table);
  app.appendChild(panel);
  const registros = await listarImportaciones();
  registros.slice(0, 50).forEach(registro => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${formatDateISO(registro.fecha)}</td><td>${registro.archivos.join(', ')}</td><td>${registro.tot_ok}</td><td>${registro.tot_dup}</td><td>${registro.tot_err}</td><td>${registro.notas}</td>`;
    tbody.appendChild(tr);
  });
}

async function renderSupermercados() {
  app.textContent = '';
  if (!requireAuth()) return;
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.innerHTML = '<h2>Gestión de supermercados</h2>';

  const form = document.createElement('form');
  form.className = 'actions-inline';
  form.innerHTML = `
    <select name="ciudad">
      <option value="Rio Segundo">Rio Segundo</option>
      <option value="Pilar">Pilar</option>
    </select>
    <input name="nombre" placeholder="Nombre" required />
    <input name="direccion" placeholder="Dirección" />
    <input name="maps" placeholder="URL de Google Maps" />
    <input name="horarios" placeholder="Horarios" />
    <button class="button" type="submit">Agregar</button>
  `;
  panel.appendChild(form);

  const list = document.createElement('table');
  list.innerHTML = '<thead><tr><th>Nombre</th><th>Ciudad</th><th>Dirección</th><th>Maps</th><th>Acciones</th></tr></thead>';
  const tbody = document.createElement('tbody');
  list.appendChild(tbody);
  panel.appendChild(list);
  app.appendChild(panel);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    await saveSupermercado({
      nombre: data.get('nombre'),
      ciudad: data.get('ciudad'),
      direccion: data.get('direccion'),
      maps_url: data.get('maps'),
      horarios: data.get('horarios'),
      activo: true,
    });
    form.reset();
    await cargar();
  });

  async function cargar() {
    tbody.textContent = '';
    for (const ciudad of ['Rio Segundo', 'Pilar']) {
      const supermercados = await fetchSupermercados(ciudad);
      supermercados.forEach(supermercado => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${supermercado.nombre}</td><td>${supermercado.ciudad}</td><td>${supermercado.direccion || ''}</td><td>${supermercado.maps_url ? '<a href="' + supermercado.maps_url + '" target="_blank">Abrir</a>' : ''}</td>`;
        const acciones = document.createElement('td');
        const eliminar = document.createElement('button');
        eliminar.className = 'button secondary';
        eliminar.type = 'button';
        eliminar.textContent = 'Eliminar';
        eliminar.addEventListener('click', async () => {
          await deleteSupermercado(supermercado.id);
          await cargar();
        });
        acciones.appendChild(eliminar);
        tr.appendChild(acciones);
        tbody.appendChild(tr);
      });
    }
  }

  await cargar();
}

function renderAjustes() {
  app.textContent = '';
  if (!requireAuth()) return;
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.innerHTML = '<h2>Ajustes</h2>';

  const csvLimit = document.createElement('p');
  csvLimit.textContent = 'Límite tamaño CSV: 25 MB (validado en cliente).';
  panel.appendChild(csvLimit);

  const defaultCityLabel = document.createElement('label');
  defaultCityLabel.textContent = 'Ciudad por defecto del front:';
  const defaultCitySelect = document.createElement('select');
  ['Rio Segundo', 'Pilar'].forEach(ciudad => {
    const option = document.createElement('option');
    option.value = ciudad;
    option.textContent = ciudad;
    defaultCitySelect.appendChild(option);
  });
  defaultCityLabel.appendChild(defaultCitySelect);
  panel.appendChild(defaultCityLabel);

  const toggleOcultar = document.createElement('label');
  toggleOcultar.textContent = 'Ocultar vencidas automáticamente';
  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.checked = true;
  toggleOcultar.appendChild(toggleInput);
  panel.appendChild(toggleOcultar);

  const legalLabel = document.createElement('label');
  legalLabel.textContent = 'Texto de leyenda legal:';
  const legalTextarea = document.createElement('textarea');
  legalTextarea.rows = 3;
  legalLabel.appendChild(legalTextarea);
  panel.appendChild(legalLabel);

  const save = document.createElement('button');
  save.className = 'button';
  save.type = 'button';
  save.textContent = 'Guardar ajustes';
  panel.appendChild(save);

  const prefs = getPreferences();
  if (prefs['ajuste:ciudad_defecto']) defaultCitySelect.value = prefs['ajuste:ciudad_defecto'];
  if (prefs['ajuste:ocultar_vencidas'] !== undefined) toggleInput.checked = !!prefs['ajuste:ocultar_vencidas'];
  if (prefs['ajuste:legal']) legalTextarea.value = prefs['ajuste:legal'];

  save.addEventListener('click', async () => {
    setPreference('ajuste:ciudad_defecto', defaultCitySelect.value);
    setPreference('ajuste:ocultar_vencidas', toggleInput.checked);
    setPreference('ajuste:legal', legalTextarea.value.trim());
    await upsertAjuste('leyenda_legal', legalTextarea.value.trim());
    const ok = document.createElement('p');
    ok.textContent = 'Ajustes guardados localmente. Integrar persistencia backend aquí.';
    panel.appendChild(ok);
  });

  app.appendChild(panel);
}

function updateNav() {
  navButtons.forEach(button => {
    button.classList.toggle('active', button.dataset.tab === currentTab);
  });
}

function restoreSession() {
  const prefs = getPreferences();
  const registro = prefs['xanaeslab:admin:otp'];
  if (registro && registro.validUntil && registro.validUntil > Date.now()) {
    return { email: registro.email, validUntil: registro.validUntil };
  }
  return null;
}
