// Script para actualizar la copia de datos incluida en la app (src/data/bundled.json).
// Se ejecuta a mano con "npm run update-data" antes de sacar una versión nueva de la app.
import { writeFileSync } from 'node:fs';

const DATA_URL = 'https://sbn998.github.io/buses-jerez/data.json';
const DESTINO = new URL('../src/data/bundled.json', import.meta.url);

const res = await fetch(DATA_URL);
if (!res.ok) throw new Error(`No se pudo descargar ${DATA_URL}: ${res.status}`);
const texto = await res.text();
const data = JSON.parse(texto);

// Comprobaciones de seguridad: formato conocido y las 18 líneas.
if (data.schemaVersion !== 1) throw new Error(`schemaVersion inesperado: ${data.schemaVersion}`);
if (data.lines.length !== 18) throw new Error(`Se esperaban 18 líneas y hay ${data.lines.length}`);

writeFileSync(DESTINO, texto);
console.log(`Guardado ${decodeURIComponent(DESTINO.pathname)} (${(texto.length / 1024 / 1024).toFixed(2)} MB, ${data.lines.length} líneas)`);
