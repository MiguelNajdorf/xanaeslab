import fs from 'fs';
import path from 'path';

const requiredFiles = [
  'www/index.html',
  'www/styles/main.css',
  'www/scripts/app.js',
  'www/data/sample.csv'
];

const missing = requiredFiles.filter(file => !fs.existsSync(path.resolve(file)));
if (missing.length) {
  console.error('Archivos faltantes:', missing.join(', '));
  process.exit(1);
}
console.log('Smoke test OK - estructura base presente.');
