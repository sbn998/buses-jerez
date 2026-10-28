/**
 * Validación: el filtro que impide publicar datos rotos.
 *
 * Mostrar una hora equivocada es peor que no mostrar nada, así que antes de
 * publicar se comprueba que los datos tienen sentido. Si hay algún error, el
 * proceso no publica y la app sigue con la última versión buena.
 *
 * Devuelve la lista de errores encontrados. Vacía = todo correcto.
 */
import type { Dataset } from '../../src/data/schema';

const EXPECTED_LINES = Array.from({ length: 18 }, (_, i) => String(i + 1));
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
// Zona de Jerez, incluidas las pedanías (Guadalcacín, Nueva Jarilla, El Portal...).
const LAT = [36.55, 36.85];
const LON = [-6.35, -5.85];
// Bajadas máximas permitidas respecto a la versión anterior (decisión del plan).
const MAX_TIMES_DROP = 0.2;
const MAX_STOPS_DROP = 0.1;

const countTimes = (ds: Dataset) =>
  ds.lines.reduce(
    (sum, line) =>
      sum + Object.values(line.timesByStop).reduce((s, t) => s + t.lab.length + t.sab.length + t.fes.length, 0),
    0,
  );

export function validate(ds: Dataset, previous: Dataset | null): string[] {
  const errors: string[] = [];

  // 1. Están exactamente las 18 líneas.
  const ids = ds.lines.map((l) => l.id);
  for (const id of EXPECTED_LINES) if (!ids.includes(id)) errors.push(`missing line ${id}`);
  for (const id of ids) if (!EXPECTED_LINES.includes(id)) errors.push(`unexpected line ${id}`);

  for (const line of ds.lines) {
    // 2. Cada línea tiene paradas y algún sentido.
    if (line.stopCodes.length < 2) errors.push(`line ${line.id} has ${line.stopCodes.length} stops`);
    if (line.directions.length < 1) errors.push(`line ${line.id} has no directions`);

    for (const code of line.stopCodes) {
      // 3. Cada parada tiene ubicación dentro de Jerez.
      const stop = ds.stops[code];
      if (!stop) errors.push(`stop ${code} (line ${line.id}) has no coordinates`);
      else if (stop.lat < LAT[0] || stop.lat > LAT[1] || stop.lon < LON[0] || stop.lon > LON[1]) {
        errors.push(`stop ${code} (line ${line.id}) is outside Jerez: ${stop.lat},${stop.lon}`);
      }

      // 4. Cada parada tiene horas en algún tipo de día.
      const times = line.timesByStop[code];
      if (!times || times.lab.length + times.sab.length + times.fes.length === 0) {
        errors.push(`stop ${code} (line ${line.id}) has no times`);
        continue;
      }

      // 5. Las horas tienen formato HH:MM y van en orden.
      for (const day of ['lab', 'sab', 'fes'] as const) {
        const list = times[day];
        list.forEach((t, i) => {
          if (!TIME.test(t)) errors.push(`stop ${code} (line ${line.id}) ${day} bad time "${t}"`);
          else if (i > 0 && t < list[i - 1]) errors.push(`stop ${code} (line ${line.id}) ${day} times out of order at "${t}"`);
        });
      }
    }
  }

  // 6. No hay caídas bruscas respecto a la versión anterior (señal de que algo se descargó mal).
  if (previous) {
    const prevTimes = countTimes(previous);
    const nowTimes = countTimes(ds);
    if (prevTimes > 0 && nowTimes < prevTimes * (1 - MAX_TIMES_DROP)) {
      errors.push(`times dropped from ${prevTimes} to ${nowTimes}`);
    }
    const prevStops = Object.keys(previous.stops).length;
    const nowStops = Object.keys(ds.stops).length;
    if (prevStops > 0 && nowStops < prevStops * (1 - MAX_STOPS_DROP)) {
      errors.push(`stops dropped from ${prevStops} to ${nowStops}`);
    }
  }

  return errors;
}
