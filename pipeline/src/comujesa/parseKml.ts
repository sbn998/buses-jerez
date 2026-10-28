/**
 * Lee el mapa oficial de una línea en formato KML (el formato de Google My Maps).
 *
 * Un KML es un XML con "Placemarks" (marcas en el mapa):
 * - Las que tienen un <Point> son paradas. Su descripción trae el código y el sentido:
 *   "COD: 343 SENTIDO: Esteve LATITUD: 36.681745 LONGITUD: -6.136679".
 * - Las que tienen un <LineString> son el dibujo del recorrido: una lista de puntos
 *   "lon,lat,altura" separados por espacios.
 */
import { XMLParser } from 'fast-xml-parser';

export interface KmlStop {
  code: string;
  name: string;
  description: string;
  lat: number;
  lon: number;
}

export interface Kml {
  title: string;
  stops: KmlStop[];
  shapes: [number, number][][];
}

/** Recorre el XML ya convertido a objetos y devuelve todas las Placemarks, estén donde estén. */
function collectPlacemarks(node: unknown, out: Record<string, unknown>[] = []) {
  if (Array.isArray(node)) node.forEach((n) => collectPlacemarks(n, out));
  else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'Placemark') [value].flat().forEach((p) => out.push(p as Record<string, unknown>));
      else collectPlacemarks(value, out);
    }
  }
  return out;
}

/** Convierte "lon,lat,alt lon,lat,alt ..." en una lista de puntos [lon, lat]. */
function parseCoordinates(text: string): [number, number][] {
  return text
    .trim()
    .split(/\s+/)
    .map((triple) => triple.split(',').map(Number))
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))
    .map(([lon, lat]) => [lon, lat]);
}

export function parseKml(xml: string): Kml {
  const doc = new XMLParser({ ignoreAttributes: true, parseTagValue: false }).parse(xml);
  const stops: KmlStop[] = [];
  const shapes: [number, number][][] = [];

  for (const pm of collectPlacemarks(doc)) {
    const point = pm.Point as { coordinates?: string } | undefined;
    const line = pm.LineString as { coordinates?: string } | undefined;
    if (point?.coordinates) {
      // La descripción separa los campos con <br>: se cambian por espacios.
      const description = String(pm.description ?? '').replace(/<br\s*\/?>/gi, ' ');
      const code = description.match(/COD:\s*(\d+)/)?.[1];
      if (!code) continue;
      const [lon, lat] = parseCoordinates(point.coordinates)[0];
      stops.push({
        code,
        name: String(pm.name ?? '').trim(),
        description: description.match(/SENTIDO:\s*(.*?)\s*LATITUD:/s)?.[1]?.trim() ?? '',
        lat,
        lon,
      });
    } else if (line?.coordinates) {
      shapes.push(parseCoordinates(line.coordinates));
    }
  }

  return { title: String(doc?.kml?.Document?.name ?? '').trim(), stops, shapes };
}

/** "Línea 1 (ESTEVE - SAN TELMO)" → "Esteve - San Telmo": el texto entre paréntesis, con mayúscula inicial. */
export function parseLineName(kmlTitle: string): string {
  const inside = kmlTitle.match(/\((.*)\)/)?.[1] ?? kmlTitle;
  return inside
    .toLocaleLowerCase('es')
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('es'))
    .trim();
}
