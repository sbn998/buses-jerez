/**
 * Escribe el estilo del mapa en `out/map/style.json`.
 *
 * El estilo (ver style.ts) es el "manual de dibujo" del mapa: qué colores y capas usar.
 * Lo genera el proceso diario de datos justo antes de publicar la web, para que la app
 * lo descargue de https://sbn998.github.io/buses-jerez/map/style.json.
 * Se ejecuta con `npm run write-style`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStyle } from './style';

/** Dirección pública donde se publica la web (de ahí cuelgan jerez.pmtiles, style.json y fonts/). */
const BASE_URL = 'https://sbn998.github.io/buses-jerez';

/** Crea `<outDir>/map/style.json`. Por defecto, la carpeta `pipeline/out`. */
export function writeStyle(outDir: string = fileURLToPath(new URL('../../out/', import.meta.url))): string {
  const mapDir = join(outDir, 'map');
  mkdirSync(mapDir, { recursive: true });
  const file = join(mapDir, 'style.json');
  writeFileSync(file, JSON.stringify(buildStyle(BASE_URL)));
  return file;
}

// Solo escribe cuando se lanza el programa directamente, no al importarlo desde las pruebas.
if (process.argv[1]?.endsWith('writeStyle.ts')) {
  console.log(`Estilo escrito en ${writeStyle()}`);
}
