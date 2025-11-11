import { formatCurrency } from '../utils/format.js';
import { normalizeRow, buildDedupKey } from '../utils/normalization.js';

const EXPECTED_HEADERS = [
  'supermercado',
  'ciudad',
  'categoria',
  'producto',
  'marca',
  'presentacion',
  'sku_presentacion_capturada',
  'promo_tipo',
  'promo_param',
  'promo_condicion',
  'precio_individual',
  'precio_total',
  'moneda',
  'vigencia_desde',
  'vigencia_hasta',
  'fuente',
  'id_externo',
  'pagina',
  'posicion'
];

export class CsvImporter {
  async parseFile(file) {
    const text = await file.text();
    return this.parseText(text);
  }

  parseText(text) {
    const rows = text.split(/\r?\n/).filter(Boolean);
    if (rows.length === 0) {
      throw new Error('El archivo está vacío');
    }

    const headers = rows[0].split(',');
    if (!this.validateHeaders(headers)) {
      throw new Error('Encabezados inválidos. Verificá el contrato.');
    }

    const dataRows = rows.slice(1);
    const parsed = [];
    for (const [index, rowText] of dataRows.entries()) {
      const values = this.splitCsvRow(rowText);
      const raw = {};
      for (let i = 0; i < headers.length; i += 1) {
        raw[headers[i]] = values[i] ?? '';
      }
      const normalized = normalizeRow(raw, index + 1);
      parsed.push(normalized);
    }

    const deduped = this.applyDedup(parsed);
    const enriched = this.applyOutliers(deduped.valid);

    return {
      headers,
      rows: deduped.all,
      validRows: enriched,
      rejected: deduped.rejected,
      duplicates: deduped.duplicates
    };
  }

  validateHeaders(headers) {
    if (headers.length !== EXPECTED_HEADERS.length) {
      return false;
    }
    return headers.every((header, index) => header.trim() === EXPECTED_HEADERS[index]);
  }

  splitCsvRow(rowText) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < rowText.length; i += 1) {
      const char = rowText[i];
      if (char === '"') {
        if (inQuotes && rowText[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  applyDedup(rows) {
    const seen = new Map();
    const duplicates = [];
    const rejected = [];
    const valid = [];
    const all = [];

    for (const entry of rows) {
      const { row, errors, warnings } = entry;
      const key = buildDedupKey(row);
      const item = { row, errors: [...errors], warnings: [...warnings], duplicate: false };

      if (errors.length) {
        item.status = 'error';
        rejected.push(item);
      } else if (seen.has(key)) {
        item.status = 'duplicate';
        item.duplicate = true;
        duplicates.push(item);
      } else {
        item.status = 'valid';
        seen.set(key, row);
        valid.push(item);
      }
      all.push(item);
    }
    return { valid, duplicates, rejected, all };
  }

  applyOutliers(entries) {
    const byCategory = new Map();
    for (const entry of entries) {
      const category = entry.row.categoria || 'Sin categoría';
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category).push(entry.row.precioEfectivo);
    }

    const stats = new Map();
    for (const [category, values] of byCategory.entries()) {
      if (values.length < 2) continue;
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
      const std = Math.sqrt(variance);
      stats.set(category, { mean, std });
    }

    for (const entry of entries) {
      const categoryStats = stats.get(entry.row.categoria || 'Sin categoría');
      if (!categoryStats) continue;
      const deviation = Math.abs(entry.row.precioEfectivo - categoryStats.mean);
      if (categoryStats.std && deviation > categoryStats.std * 3) {
        entry.warnings.push(`Precio fuera de rango esperado (${formatCurrency(categoryStats.mean)} ±3σ)`);
      }
    }
    return entries;
  }

  buildErrorReport(entries) {
    const lines = ['fila,errores'];
    for (const entry of entries) {
      const errorText = entry.errors.join(' | ');
      lines.push(`${entry.row.index},${JSON.stringify(errorText)}`);
    }
    return lines.join('\n');
  }

  buildSummary({ validRows, duplicates, rejected }) {
    return {
      valid: validRows.length,
      duplicates: duplicates.length,
      rejected: rejected.length
    };
  }
}

export function renderPreviewTable({ container, headers, entries }) {
  const thead = container.querySelector('thead');
  const tbody = container.querySelector('tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  if (!entries.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = headers.length + 2;
    cell.textContent = 'Sin datos';
    row.append(cell);
    tbody.append(row);
    return;
  }

  const headerRow = document.createElement('tr');
  for (const header of headers) {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.append(th);
  }
  const statusTh = document.createElement('th');
  statusTh.textContent = 'Estado';
  headerRow.append(statusTh);
  thead.append(headerRow);

  for (const entry of entries) {
    const rowElement = document.createElement('tr');
    if (entry.errors.length) {
      rowElement.classList.add('table-error');
    } else if (entry.warnings.length) {
      rowElement.classList.add('table-warning');
    }

    for (const header of headers) {
      const cell = document.createElement('td');
      cell.textContent = entry.row[camelCase(header)] ?? '';
      rowElement.append(cell);
    }
    const statusCell = document.createElement('td');
    statusCell.textContent = entry.errors.length
      ? entry.errors.join(' | ')
      : entry.duplicate
        ? 'Duplicado'
        : entry.warnings.join(' | ') || 'OK';
    rowElement.append(statusCell);
    tbody.append(rowElement);
  }
}

function camelCase(header) {
  return header.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}
