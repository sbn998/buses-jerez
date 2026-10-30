/**
 * Script para crear un fixture de OCR: descarga un PDF de Comujesa, lee su imagen con OCR
 * y guarda el resultado en test/fixtures/ocr/<nombre>.json.
 * Uso: npm run ocr-fixture -- <url-del-pdf> <nombre>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { USER_AGENT } from '../http';
import { extractJpeg } from './extractJpeg';
import { createOcr } from './ocr';

const [url, name] = process.argv.slice(2);
if (!url || !name) {
  console.error('Uso: npm run ocr-fixture -- <url-del-pdf> <nombre>');
  process.exit(1);
}

const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`);
const pdf = new Uint8Array(await res.arrayBuffer());

const ocr = await createOcr();
try {
  const page = await ocr.read(extractJpeg(pdf));
  const dir = new URL('../../test/fixtures/ocr/', import.meta.url);
  mkdirSync(dir, { recursive: true });
  // Una palabra por línea: el archivo es largo pero compacto y fácil de revisar en git.
  const body =
    `{"width":${page.width},"height":${page.height},"words":[\n` +
    page.words.map((w) => JSON.stringify(w)).join(',\n') +
    '\n]}\n';
  writeFileSync(new URL(`${name}.json`, dir), body);
  console.log(`${page.words.length} palabras guardadas en test/fixtures/ocr/${name}.json`);
} finally {
  await ocr.close();
}
