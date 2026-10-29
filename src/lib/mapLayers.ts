// Ayudas del mapa: la dirección del estilo, la zona de Jerez y la conversión de paradas
// y recorridos al formato GeoJSON que entiende MapLibre.
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

import type { Stop } from '@/data/schema';

// Estilo del mapa (publicado en GitHub Pages; usa el archivo jerez.pmtiles).
export const MAP_STYLE_URL = 'https://sbn998.github.io/buses-jerez/map/style.json';

// Caja de la zona del mapa: [lonMin, latMin, lonMax, latMax].
export const JEREZ_BOUNDS: [number, number, number, number] = [-6.35, 36.55, -5.85, 36.85];

// Convierte paradas en puntos GeoJSON. OJO: GeoJSON usa [lon, lat], al revés que "lat, lon".
// `extra` permite añadir propiedades propias a cada punto.
export function stopsToGeoJSON(
  stops: Stop[],
  extra?: (s: Stop) => Record<string, unknown>,
): FeatureCollection<Point> {
  const features: Feature<Point>[] = stops.map((s) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
    properties: { code: s.code, name: s.name, approximate: s.approximate === true, ...extra?.(s) },
  }));
  return { type: 'FeatureCollection', features };
}

// Convierte los trazados de una línea (listas de [lon, lat]) en líneas GeoJSON con su color.
export function shapesToGeoJSON(
  shapes: [number, number][][],
  colour: string,
): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = shapes.map((coordinates) => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates },
    properties: { colour },
  }));
  return { type: 'FeatureCollection', features };
}

// Convierte rutas de un trayecto (listas de [lon, lat] con su color) en líneas GeoJSON.
export function routesToGeoJSON(
  routes: { coords: [number, number][]; colour: string }[],
): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = routes.map((r) => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: r.coords },
    properties: { colour: r.colour },
  }));
  return { type: 'FeatureCollection', features };
}

// Convierte el origen y el destino en puntos GeoJSON ([lon, lat]) con la propiedad `kind`.
export function placesToGeoJSON(
  places: { lat: number; lon: number; kind: 'origin' | 'destination' }[],
): FeatureCollection<Point> {
  const features: Feature<Point>[] = places.map((p) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    properties: { kind: p.kind },
  }));
  return { type: 'FeatureCollection', features };
}

// Caja que contiene todos los puntos [lon, lat]: [lonMin, latMin, lonMax, latMax]. Sin puntos, null.
export function boundsOf(points: [number, number][]): [number, number, number, number] | null {
  if (points.length === 0) return null;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of points) {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  }
  return [minLon, minLat, maxLon, maxLat];
}
