/**
 * Pone coordenadas a los puntos de recarga (`topup-points.json`) usando Nominatim,
 * el buscador de direcciones gratuito de OpenStreetMap. Es un programa manual:
 * se ejecuta una vez con `npm run geocode-topup` y se hace commit del JSON resultante.
 *
 * - Una petición cada 1,1 s (la norma de uso de Nominatim es máximo 1 por segundo)
 *   y con nuestro User-Agent, para que sepan quiénes somos.
 * - Un resultado solo vale si cae dentro de la caja de Jerez.
 * - Si el resultado es un local concreto (casa, edificio, comercio) es exacto;
 *   si es solo una calle o una zona, se marca `approximate` y la app lo dibuja hueco.
 * - Si no hay resultado válido, el punto se queda sin coordenadas y solo sale en la lista.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { USER_AGENT } from './http';
import type { TopUpFile } from './topup';
import { LAT, LON } from './validate';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DELAY_MS = 1100;
// Tipos de resultado que indican un local concreto y no solo una calle o una zona.
const EXACT_TYPES = ['house', 'building', 'shop'];

/** Caja donde debe caer el resultado: [mínimo, máximo] de latitud y de longitud. */
export interface Box {
  lat: [number, number];
  lon: [number, number];
}

/** Lo que usamos de cada resultado de Nominatim (llegan las coordenadas como texto). */
export interface NominatimResult {
  lat: string;
  lon: string;
  type?: string;
  category?: string;
  addresstype?: string;
}

export interface Picked {
  lat: number;
  lon: number;
  approximate: boolean;
}

/** Texto que se envía a Nominatim: la dirección del cartel más la ciudad. */
export function geocodeQuery(address: string): string {
  return `${address}, Jerez de la Frontera, España`;
}

/** Elige el primer resultado que cae dentro de la caja. Casa, edificio o comercio = exacto; el resto, aproximado. */
export function pickResult(results: NominatimResult[], box: Box): Picked | null {
  for (const r of results) {
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < box.lat[0] || lat > box.lat[1] || lon < box.lon[0] || lon > box.lon[1]) continue;
    const exact = [r.type, r.addresstype, r.category].some((t) => t !== undefined && EXACT_TYPES.includes(t));
    return { lat, lon, approximate: !exact };
  }
  return null;
}

/** Cuenta cuántos puntos quedaron exactos, aproximados y sin coordenadas. */
export function summarize(points: { lat?: number; lon?: number; approximate?: boolean }[]) {
  let exact = 0;
  let approximate = 0;
  let none = 0;
  for (const p of points) {
    if (p.lat === undefined || p.lon === undefined) none++;
    else if (p.approximate) approximate++;
    else exact++;
  }
  return { exact, approximate, none };
}

/** Texto del archivo con un punto por línea (así es más fácil de leer y de comparar en git). */
export function formatTopUpFile(file: TopUpFile): string {
  const { points, ...head } = file;
  const lines = Object.entries(head).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  const rows = points.map((pt) => '    ' + JSON.stringify(pt).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, '{ ').replace(/\}$/, ' }'));
  return ['{', ...lines, '  "points": [', rows.join(',\n'), '  ]', '}', ''].join('\n');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Pregunta a Nominatim por una dirección. Devuelve [] si falla (el punto se queda sin coordenadas). */
async function search(address: string): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    q: geocodeQuery(address),
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'es',
  });
  try {
    const res = await fetch(`${NOMINATIM_URL}?${params}`, { headers: { 'user-agent': USER_AGENT } });
    if (!res.ok) {
      console.error(`Nominatim respondió HTTP ${res.status} para "${address}"`);
      return [];
    }
    return (await res.json()) as NominatimResult[];
  } catch (err) {
    console.error(`No se pudo consultar "${address}": ${String(err)}`);
    return [];
  }
}

if (process.argv[1]?.endsWith('geocodeTopup.ts')) {
  const path = new URL('../topup-points.json', import.meta.url);
  const file = JSON.parse(readFileSync(path, 'utf8')) as TopUpFile;
  const box: Box = { lat: LAT as [number, number], lon: LON as [number, number] };
  let first = true;
  for (const point of file.points) {
    // Los puntos que ya tienen coordenadas no se vuelven a consultar.
    if (point.lat !== undefined && point.lon !== undefined) continue;
    if (!first) await sleep(DELAY_MS);
    first = false;
    const picked = pickResult(await search(point.address), box);
    if (picked) {
      point.lat = Number(picked.lat.toFixed(6));
      point.lon = Number(picked.lon.toFixed(6));
      point.approximate = picked.approximate;
    }
    console.log(`${picked ? (picked.approximate ? 'aproximado' : 'exacto    ') : 'sin result.'}  ${point.name}`);
  }
  writeFileSync(path, JSON.stringify(file, null, 2) + '\n');
  const s = summarize(file.points);
  console.log(`Resumen: ${s.exact} exactos, ${s.approximate} aproximados, ${s.none} sin resultado`);
}
