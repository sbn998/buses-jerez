// Cruza las ubicaciones oficiales de las paradas con las de OpenStreetMap.
// Solo genera avisos (texto): nunca lanza errores ni impide publicar los datos.
import type { Stop } from '../../src/data/schema';
import type { OsmStop } from './assemble';

/** Radio medio de la Tierra en metros. */
const RADIO_TIERRA_M = 6371000;

const toRadians = (grados: number): number => (grados * Math.PI) / 180;

/**
 * Distancia en metros entre dos puntos, en línea recta (fórmula haversine).
 * Es una copia de `distanceMeters` de src/lib/geo.ts: esa carpeta es código de la
 * app y el proceso de datos no debe depender de ella.
 */
function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(h));
}

/**
 * Devuelve un aviso por cada parada con ubicación oficial (`kml` o `name-match`)
 * cuya gemela en OSM (mismo `ref`) esté a más de `thresholdM` metros.
 * Las paradas corregidas a mano (`override`) u obtenidas de OSM se ignoran.
 */
export function osmCrossCheck(stops: Record<string, Stop>, osm: OsmStop[], thresholdM = 150): string[] {
  const byRef = new Map(osm.map((o) => [o.ref, o]));
  const warnings: string[] = [];
  for (const stop of Object.values(stops)) {
    if (stop.coordSource !== 'kml' && stop.coordSource !== 'name-match') continue;
    const twin = byRef.get(stop.code);
    if (!twin) continue;
    const meters = distanceMeters(stop, twin);
    if (meters > thresholdM) {
      warnings.push(`stop ${stop.code}: official location is ${Math.round(meters)} m from OSM ref ${twin.ref}`);
    }
  }
  return warnings;
}
