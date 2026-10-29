// Búsqueda de lugares (calles, sitios, tiendas...) de Jerez con Photon, un buscador gratuito basado en
// OpenStreetMap. Solo busca cuando se le pide (nunca letra a letra) y recuerda las búsquedas repetidas.
import { JEREZ_BOUNDS } from '@/lib/mapLayers';

/** Un lugar encontrado. `detail` (calle y número, o barrio) distingue lugares con el mismo nombre. */
export interface Place {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lon: number;
}

export const PHOTON_URL = 'https://photon.komoot.io/api/';
export const APP_USER_AGENT = 'buses-jerez-app/1.0 (+https://github.com/sbn998/buses-jerez)';

/** Por qué falló la búsqueda: sin red, servidor saturado (429) u otro fallo. */
export class SearchError extends Error {
  kind: 'offline' | 'busy' | 'failed';
  constructor(kind: 'offline' | 'busy' | 'failed') {
    super(`Search ${kind}`);
    this.name = 'SearchError';
    this.kind = kind;
  }
}

/** Construye la dirección de la petición: texto, máximo 8 resultados y solo dentro de Jerez. */
export function buildSearchUrl(query: string): string {
  return `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=8&bbox=${JEREZ_BOUNDS.join(',')}`;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Convierte la respuesta de Photon en lugares: solo puntos dentro de Jerez, con nombre o calle y sin repetidos. */
export function parsePhoton(json: unknown): Place[] {
  const features = (json as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return [];
  const [west, south, east, north] = JEREZ_BOUNDS;
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const f of features) {
    const geometry = (f as { geometry?: { type?: unknown; coordinates?: unknown } })?.geometry;
    if (geometry?.type !== 'Point' || !Array.isArray(geometry.coordinates)) continue;
    const [lon, lat] = geometry.coordinates as unknown[];
    if (typeof lon !== 'number' || typeof lat !== 'number') continue;
    if (lon < west || lon > east || lat < south || lat > north) continue;
    const p = ((f as { properties?: Record<string, unknown> }).properties ?? {}) as Record<string, unknown>;
    const street = str(p.street);
    const name = str(p.name) || street;
    if (!name) continue;
    const streetLine = [street, str(p.housenumber)].filter(Boolean).join(' ');
    const detail = streetLine || str(p.district) || str(p.locality) || str(p.city);
    const key = `${name}|${detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({ id: `${str(p.osm_type)}${String(p.osm_id ?? '')}`, name, detail, lat, lon });
  }
  return places;
}

// Caché en memoria: la misma búsqueda no vuelve a pedirse a Photon.
const cache = new Map<string, Place[]>();

/** Vacía la caché (para las pruebas). */
export function clearSearchCache(): void {
  cache.clear();
}

/** Busca lugares. Con menos de 3 letras no pide nada. Lanza SearchError si algo falla. */
export async function searchPlaces(query: string, fetchFn: typeof fetch = fetch): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  let res: Response;
  try {
    res = await fetchFn(buildSearchUrl(q), { headers: { 'User-Agent': APP_USER_AGENT } });
  } catch {
    throw new SearchError('offline');
  }
  if (res.status === 429) throw new SearchError('busy');
  if (!res.ok) throw new SearchError('failed');
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new SearchError('failed');
  }
  const places = parsePhoton(json);
  cache.set(key, places);
  return places;
}
