/**
 * Paradas de autobús de Jerez en OpenStreetMap, el mapa libre hecho por voluntarios.
 *
 * Solo se usan como último recurso, para paradas nuevas que todavía no salen en
 * los mapas oficiales de Comujesa. Muchas paradas de OSM llevan en su etiqueta
 * `ref` el mismo código que usa Comujesa, y por ese código se emparejan.
 *
 * Se consultan a Overpass, un servicio gratuito y sin clave para buscar datos de OSM.
 */
import type { OsmStop } from './assemble';

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/** Consulta: todas las paradas de autobús dentro del municipio de Jerez. */
export const OVERPASS_QUERY =
  '[out:json][timeout:60];area["name"="Jerez de la Frontera"]["admin_level"="8"]->.a;node["highway"="bus_stop"](area.a);out;';

interface OverpassResponse {
  elements: { lat: number; lon: number; tags?: Record<string, string> }[];
}

/**
 * Solo se usa la etiqueta `ref`. Si un mismo código aparece en varias paradas de
 * OSM (por ejemplo, una urbana y otra interurbana), no se sabe cuál es la buena,
 * así que ese código se descarta.
 */
export function parseOverpass(json: string): OsmStop[] {
  const data = JSON.parse(json) as OverpassResponse;
  const stops = data.elements.flatMap((e) => {
    const ref = e.tags?.ref;
    return ref ? [{ ref, name: e.tags?.name ?? '', lat: e.lat, lon: e.lon }] : [];
  });
  const count = new Map<string, number>();
  for (const s of stops) count.set(s.ref, (count.get(s.ref) ?? 0) + 1);
  return stops.filter((s) => count.get(s.ref) === 1);
}
