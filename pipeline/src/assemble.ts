/**
 * Ensamblado: junta todo lo descargado de una línea en el formato del contrato de datos.
 *
 * Para cada línea se tienen cuatro piezas: la lista de paradas del buscador (con
 * códigos), la página de la línea (sentidos), el mapa oficial (ubicaciones) y las
 * horas de cada parada. Este archivo las combina y decide de dónde sale la
 * ubicación de cada parada, por este orden de preferencia:
 *
 * 1. Corrección manual (`overrides.json`), si el autor ha puesto una.
 * 2. Mapa oficial, buscando el mismo código.
 * 3. Mapa oficial, buscando un nombre parecido. Hace falta porque a veces el
 *    código del mapa no coincide con el del buscador (Madre de Dios: 280 frente a 352).
 * 4. OpenStreetMap, buscando el mismo código en su etiqueta `ref`. Sirve para las
 *    paradas nuevas que todavía no están en los mapas oficiales.
 *
 * Si no se encuentra ninguna, la parada se queda sin ubicación y se avisa.
 * La validación bloqueará la publicación hasta que se corrija.
 */
import type { Direction, Line, Stop, StopTimes } from '../../src/data/schema';
import type { LinePage } from './comujesa/parseLinePage';
import type { StopOption } from './comujesa/parseStops';
import { parseLineName, type Kml, type KmlStop } from './comujesa/parseKml';
import { LINE_COLOURS } from './lineColours';

export interface RawLine {
  id: string;
  options: StopOption[];
  page: LinePage;
  kml: Kml | null;
  timesByStop: Record<string, StopTimes>;
}

export interface Overrides {
  /** `note` explica de dónde sale cada corrección (solo para quien lea el archivo). */
  stops: Record<string, { lat: number; lon: number; name?: string; description?: string; note?: string }>;
}

/** Parada de OpenStreetMap: `ref` es el código de Comujesa cuando alguien lo ha apuntado. */
export interface OsmStop {
  ref: string;
  name: string;
  lat: number;
  lon: number;
}

const STOPWORDS = new Set(['pz.', 'pz', 'plaza', 'de', 'del', 'la', 'las', 'el', 'los']);

/** Simplifica un nombre de parada para poder comparar nombres escritos de forma distinta. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes
    .replace(/\bc\//g, ' ') // "C/Manuel Moneo" → " manuel moneo"
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .join(' ');
}

/** Busca en el mapa la parada cuyo nombre es el comienzo más largo de la etiqueta del buscador. */
function matchByName(label: string, kmlStops: KmlStop[]): KmlStop | undefined {
  const target = normalizeName(label);
  let best: KmlStop | undefined;
  for (const k of kmlStops) {
    const n = normalizeName(k.name);
    if (n && target.startsWith(n) && n.length > (best ? normalizeName(best.name).length : 0)) best = k;
  }
  return best;
}

/** Reparte las paradas en sentidos según cuántas paradas tiene cada sentido en la web. */
function buildDirections(line: RawLine, warnings: string[]): Direction[] {
  const codes = line.options.map((o) => o.code);
  const counts = line.page.directions.map((d) => d.stopNames.length);
  const total = counts.reduce((a, b) => a + b, 0);
  if (line.page.directions.length > 0 && total === codes.length) {
    let start = 0;
    return line.page.directions.map((d, i) => {
      const stopCodes = codes.slice(start, start + counts[i]);
      start += counts[i];
      return { headsign: d.headsign, stopCodes };
    });
  }
  warnings.push(`line ${line.id}: direction stop counts (${total}) do not match stops (${codes.length}), using one direction`);
  return [{ headsign: line.options.at(-1)?.label ?? '', stopCodes: codes }];
}

export function assemble(raw: RawLine[], overrides: Overrides, osmStops: OsmStop[] = []) {
  const stops: Record<string, Stop> = {};
  const warnings: string[] = [];
  const lines: Omit<Line, 'trips'>[] = [];

  for (const line of raw) {
    const kmlStops = line.kml?.stops ?? [];
    for (const opt of line.options) {
      if (stops[opt.code]) continue; // ya ubicada desde otra línea
      const override = overrides.stops[opt.code];
      const byCode = kmlStops.find((k) => k.code === opt.code);
      if (override) {
        stops[opt.code] = {
          code: opt.code,
          name: override.name ?? byCode?.name ?? opt.label,
          description: override.description ?? byCode?.description ?? '',
          lat: override.lat,
          lon: override.lon,
          coordSource: 'override',
        };
      } else if (byCode) {
        stops[opt.code] = { ...byCode, code: opt.code, coordSource: 'kml' };
      } else {
        const byName = matchByName(opt.label, kmlStops);
        if (byName) {
          stops[opt.code] = {
            code: opt.code,
            name: byName.name,
            description: '',
            lat: byName.lat,
            lon: byName.lon,
            coordSource: 'name-match',
          };
          warnings.push(`stop ${opt.code} line ${line.id} located by name match with map stop ${byName.code}`);
        }
      }
    }

    lines.push({
      id: line.id,
      name: line.kml ? parseLineName(line.kml.title) : `Línea ${line.id}`,
      colour: LINE_COLOURS[line.id] ?? '#6B7280',
      stopCodes: line.options.map((o) => o.code),
      directions: buildDirections(line, warnings),
      shapes: line.kml?.shapes ?? [],
      timesByStop: line.timesByStop,
    });
  }
  // Último recurso: OpenStreetMap. Se mira después de todas las líneas, para que
  // un mapa oficial de otra línea tenga siempre preferencia.
  for (const line of raw) {
    for (const opt of line.options) {
      if (stops[opt.code]) continue;
      const osm = osmStops.find((o) => o.ref === opt.code);
      if (osm) {
        stops[opt.code] = {
          code: opt.code, name: osm.name || opt.label, description: '',
          lat: osm.lat, lon: osm.lon, coordSource: 'osm',
        };
      } else {
        warnings.push(`stop ${opt.code} line ${line.id} without coordinates`);
      }
    }
  }
  return { lines, stops, warnings };
}
