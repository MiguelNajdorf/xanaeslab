#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

async function main() {
  const base = path.resolve('www');
  const sample = await fs.readFile(path.join(base, 'data', 'sample.csv'), 'utf-8');
  if (!sample.includes('supermercado,ciudad')) {
    throw new Error('CSV de ejemplo inválido');
  }
  const indexHtml = await fs.readFile(path.join(base, 'index.html'), 'utf-8');
  if (!indexHtml.includes('Xanaes Lab')) {
    throw new Error('index.html no contiene la app');
  }
  console.log('Smoke test completado');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
