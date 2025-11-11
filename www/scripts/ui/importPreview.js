import { importarFilas, makeLogCSV, registrarImportacion } from '../store.js';
export function createImportPreview({ onFinished }) {
  const container = document.createElement('section');
  container.className = 'section-card import-preview';

  const title = document.createElement('h2');
  title.textContent = 'Importar CSV';
  container.appendChild(title);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.csv';
  fileInput.multiple = true;
  container.appendChild(fileInput);

  const limitInfo = document.createElement('p');
  limitInfo.textContent = 'Tamaño máximo por archivo: 25 MB. Se simula guardado local descargando el archivo original al finalizar.';
  container.appendChild(limitInfo);

  const progressWrapper = document.createElement('div');
  progressWrapper.className = 'progress-bar';
  const progress = document.createElement('span');
  progress.style.width = '0%';
  progressWrapper.appendChild(progress);
  container.appendChild(progressWrapper);

  const counters = document.createElement('p');
  counters.textContent = 'Esperando archivos…';
  container.appendChild(counters);

  const logButton = document.createElement('button');
  logButton.className = 'button-tertiary';
  logButton.type = 'button';
  logButton.textContent = 'Descargar log (.csv)';
  logButton.disabled = true;
  container.appendChild(logButton);

  const resultList = document.createElement('div');
  resultList.className = 'card-grid';
  container.appendChild(resultList);

  fileInput.addEventListener('change', async () => {
    if (!fileInput.files?.length) return;
    const archivos = Array.from(fileInput.files);
    let totalResultados = [];
    let resumenGlobal = { ok: 0, dup: 0, err: 0 };
    for (const file of archivos) {
      if (file.size > 25 * 1024 * 1024) {
        alert(`El archivo ${file.name} supera los 25 MB.`);
        continue;
      }
      const texto = await file.text();
      const filas = parseCSV(texto);
      let progresoActual = 0;
      const { resultados, resumen } = await importarFilas(filas, ({ current, total, ok, dup, err }) => {
        progresoActual = Math.round((current / total) * 100);
        progress.style.width = `${progresoActual}%`;
        counters.textContent = `${file.name}: ${current}/${total} filas · OK ${ok} · Duplicadas ${dup} · Errores ${err}`;
      });
      totalResultados = totalResultados.concat(resultados);
      resumenGlobal.ok += resumen.ok;
      resumenGlobal.dup += resumen.dup;
      resumenGlobal.err += resumen.err;
      downloadOriginal(file);
      await registrarImportacion({
        archivos: [file.name],
        tot_ok: resumen.ok,
        tot_dup: resumen.dup,
        tot_err: resumen.err,
        notas: 'Importación local sin backend',
      });
    }

    progress.style.width = '100%';
    counters.textContent = `Finalizado · OK ${resumenGlobal.ok} · Duplicadas ${resumenGlobal.dup} · Errores ${resumenGlobal.err}`;
    renderResultados(totalResultados);

    const logCSV = makeLogCSV(totalResultados);
    logButton.disabled = false;
    logButton.onclick = () => {
      const blob = new Blob([logCSV], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `log-import-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    onFinished?.(resumenGlobal);
  });

  function parseCSV(texto) {
    const lines = texto.trim().split(/\r?\n/);
    const headers = lines.shift().split(',');
    return lines.filter(Boolean).map(line => {
      const values = line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(v => v.replace(/^\"|\"$/g, ''));
      const fila = {};
      headers.forEach((header, idx) => {
        fila[header] = values[idx] || '';
      });
      return fila;
    });
  }

  function downloadOriginal(file) {
    const date = new Date();
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    const slug = file.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = `${y}${m}${d}-super-${slug}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function renderResultados(resultados) {
    resultList.textContent = '';
    resultados.slice(0, 50).forEach(item => {
      const card = document.createElement('article');
      card.className = 'product-card';
      const status = document.createElement('span');
      status.className = `badge ${item.status === 'ok' ? 'badge-status-ok' : item.status === 'duplicada' ? 'badge-status-dup' : 'badge-status-err'}`;
      status.textContent = item.status.toUpperCase();
      const producto = document.createElement('h4');
      producto.textContent = `${item.fila.producto} (${item.fila.marca})`;
      const precio = document.createElement('p');
      precio.textContent = `Precio: ${item.fila.precio_individual}`;
      const vigencia = document.createElement('p');
      vigencia.textContent = `Vigencia: ${item.fila.vigencia_desde} - ${item.fila.vigencia_hasta}`;
      if (item.errores?.length) {
        const errores = document.createElement('p');
        errores.textContent = `Errores: ${item.errores.join(' · ')}`;
        card.append(status, producto, precio, vigencia, errores);
      } else {
        card.append(status, producto, precio, vigencia);
      }
      resultList.appendChild(card);
    });
  }

  return container;
}
