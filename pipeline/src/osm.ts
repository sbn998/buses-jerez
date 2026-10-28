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

export function parseOverpass(json: string): OsmStop[] {
  const data = JSON.parse(json) as OverpassResponse;
  return data.elements.flatMap((e) => {
    const ref = e.tags?.ref ?? e.tags?.local_ref;
    return ref ? [{ ref, name: e.tags?.name ?? '', lat: e.lat, lon: e.lon }] : [];
  });
}
