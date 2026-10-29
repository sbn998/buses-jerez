/**
 * Validación: el filtro que impide publicar datos rotos.
 *
 * Mostrar una hora equivocada es peor que no mostrar nada, así que antes de
 * publicar se comprueba que los datos tienen sentido. Si hay algún error, el
 * proceso no publica y la app sigue con la última versión buena.
 *
 * Devuelve la lista de errores encontrados. Vacía = todo correcto.
 */
import type { Dataset, DayType } from '../../src/data/schema';

const EXPECTED_LINES = Array.from({ length: 18 }, (_, i) => String(i + 1));
const DAY_TYPES: DayType[] = ['lab', 'sab', 'fes'];
const TOPUP_ZONES = ['oficina', 'centro', 'oeste', 'este', 'norte', 'sur'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
// Zona de Jerez, incluidas las pedanías (Guadalcacín, Nueva Jarilla, El Portal...).
export const LAT = [36.55, 36.85];
export const LON = [-6.35, -5.85];
// Cambios máximos permitidos respecto a la versión anterior (decisión del plan).
// Un cambio mayor suele ser señal de que algo se descargó o se leyó mal.
const MAX_TIMES_DROP = 0.2;
const MAX_TIMES_RISE = 0.3;
const MAX_STOPS_DROP = 0.1;

/** ¿Es una fecha AAAA-MM-DD que existe de verdad? (rechaza "2026-02-30" y "29/10/2026") */
const isRealDate = (text: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [y, m, d] = text.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

const countTimes = (ds: Dataset) =>
  ds.lines.reduce(
    (sum, line) =>
      sum + Object.values(line.timesByStop).reduce((s, t) => s + t.lab.length + t.sab.length + t.fes.length, 0),
    0,
  );

/** ¿Tiene esta línea alguna hora en este tipo de día? */
const lineHasDay = (ds: Dataset, lineId: string, day: DayType) =>
  Object.values(ds.lines.find((l) => l.id === lineId)?.timesByStop ?? {}).some((t) => t[day].length > 0);

export function validate(ds: Dataset, previous: Dataset | null): string[] {
  const errors: string[] = [];

  // 1. Están exactamente las 18 líneas.
  const ids = ds.lines.map((l) => l.id);
  for (const id of EXPECTED_LINES) if (!ids.includes(id)) errors.push(`missing line ${id}`);
  for (const id of ids) if (!EXPECTED_LINES.includes(id)) errors.push(`unexpected line ${id}`);

  for (const line of ds.lines) {
    // 2. Cada línea tiene paradas, algún sentido y el dibujo de su recorrido
    //    (si falta, la página de la línea o su mapa oficial no se leyeron bien).
    if (line.stopCodes.length < 2) errors.push(`line ${line.id} has ${line.stopCodes.length} stops`);
    if (line.directions.length < 1) errors.push(`line ${line.id} has no directions`);
    if (line.shapes.length < 1) errors.push(`line ${line.id} has no map route`);

    for (const code of line.stopCodes) {
      // 3. Cada parada tiene una ubicación válida dentro de Jerez.
      const stop = ds.stops[code];
      if (!stop) errors.push(`stop ${code} (line ${line.id}) has no coordinates`);
      else if (!Number.isFinite(stop.lat) || !Number.isFinite(stop.lon)) {
        errors.push(`stop ${code} (line ${line.id}) has invalid coordinates: ${stop.lat},${stop.lon}`);
      } else if (stop.lat < LAT[0] || stop.lat > LAT[1] || stop.lon < LON[0] || stop.lon > LON[1]) {
        errors.push(`stop ${code} (line ${line.id}) is outside Jerez: ${stop.lat},${stop.lon}`);
      }

      // 4. Cada parada tiene horas en algún tipo de día.
      const times = line.timesByStop[code];
      if (!times || times.lab.length + times.sab.length + times.fes.length === 0) {
        errors.push(`stop ${code} (line ${line.id}) has no times`);
        continue;
      }

      // 5. Las horas tienen formato HH:MM, van en orden y no se repiten.
      for (const day of DAY_TYPES) {
        const list = times[day];
        list.forEach((t, i) => {
          if (!TIME.test(t)) errors.push(`stop ${code} (line ${line.id}) ${day} bad time "${t}"`);
          else if (i > 0 && t < list[i - 1]) errors.push(`stop ${code} (line ${line.id}) ${day} times out of order at "${t}"`);
          else if (i > 0 && t === list[i - 1]) errors.push(`stop ${code} (line ${line.id}) ${day} duplicate time "${t}"`);
        });
      }
    }
  }

  // 6. Dos paradas distintas en el mismo punto exacto suelen significar que a una
  //    se le ha copiado la ubicación de otra. Se acepta solo si todas las ubicaciones
  //    salen del mapa oficial de Comujesa (que a veces lo hace así con paradas de
  //    aceras opuestas) o si alguna es una corrección manual del autor.
  const byPoint = new Map<string, string[]>();
  for (const stop of Object.values(ds.stops)) {
    const key = `${stop.lat},${stop.lon}`;
    byPoint.set(key, [...(byPoint.get(key) ?? []), stop.code]);
  }
  for (const codes of byPoint.values()) {
    const sources = codes.map((c) => ds.stops[c].coordSource);
    const official = sources.every((src) => src === 'kml' || src === 'name-match');
    if (codes.length > 1 && !official && !sources.includes('override')) {
      errors.push(`stops ${codes.join(', ')} share the same coordinates`);
    }
  }

  // 7. Puntos de recarga (si los hay): al menos uno, con nombre, dirección y zona válidos.
  if (ds.topUpPoints) {
    if (ds.topUpPoints.length < 1) errors.push('top-up points list is empty');
    ds.topUpPoints.forEach((p, i) => {
      if (!p.name?.trim()) errors.push(`top-up point #${i} has no name`);
      if (!p.address?.trim()) errors.push(`top-up point #${i} (${p.name}) has no address`);
      if (!TOPUP_ZONES.includes(p.zone)) errors.push(`top-up point #${i} (${p.name}) has invalid zone "${p.zone}"`);
      // Coordenadas (opcionales): van las dos juntas y dentro de la caja de Jerez.
      if ((p.lat === undefined) !== (p.lon === undefined)) {
        errors.push(`top-up point #${i} (${p.name}) has only one of lat/lon coordinates`);
      } else if (p.lat !== undefined && p.lon !== undefined) {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || p.lat < LAT[0] || p.lat > LAT[1] || p.lon < LON[0] || p.lon > LON[1]) {
          errors.push(`top-up point #${i} (${p.name}) is outside Jerez: ${p.lat},${p.lon}`);
        }
      }
    });
    // Si hay puntos, tiene que constar cuándo se revisó el cartel.
    if (ds.topUpChecked === undefined) errors.push('topUpChecked is missing (required with topUpPoints)');
  }
  // La fecha de revisión, si existe, debe ser AAAA-MM-DD y un día real (no 2026-02-30).
  if (ds.topUpChecked !== undefined && !isRealDate(ds.topUpChecked)) {
    errors.push(`topUpChecked is not a valid YYYY-MM-DD date: "${ds.topUpChecked}"`);
  }

  // 8. Comparación con la versión anterior.
  if (previous) {
    const prevTimes = countTimes(previous);
    const nowTimes = countTimes(ds);
    if (prevTimes > 0 && nowTimes < prevTimes * (1 - MAX_TIMES_DROP)) {
      errors.push(`times dropped from ${prevTimes} to ${nowTimes}`);
    }
    if (prevTimes > 0 && nowTimes > prevTimes * (1 + MAX_TIMES_RISE)) {
      errors.push(`times rose from ${prevTimes} to ${nowTimes}`);
    }
    const prevStops = Object.keys(previous.stops).length;
    const nowStops = Object.keys(ds.stops).length;
    if (prevStops > 0 && nowStops < prevStops * (1 - MAX_STOPS_DROP)) {
      errors.push(`stops dropped from ${prevStops} to ${nowStops}`);
    }
    // Si una línea tenía horario un tipo de día (por ejemplo, sábados) y ahora no
    // tiene ninguno, lo más probable es que esa parte no se haya leído bien.
    for (const line of previous.lines) {
      for (const day of DAY_TYPES) {
        if (lineHasDay(previous, line.id, day) && !lineHasDay(ds, line.id, day)) {
          errors.push(`line ${line.id} had ${day} times and now has none`);
        }
      }
    }
  }

  return errors;
}
