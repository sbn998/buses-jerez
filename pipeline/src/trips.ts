/**
 * Reconstrucción de viajes.
 *
 * Comujesa solo dice "por la parada X pasan buses a estas horas", pero no qué hora
 * de una parada corresponde al mismo autobús en la siguiente. Para "Cómo llego"
 * hace falta saberlo (si cojo el de las 7:28 en Plaza Esteve, ¿a qué hora llego a
 * Constitución?). Aquí se reconstruye cada viaje recorriendo las paradas en orden.
 *
 * No basta con emparejar "el primero con el primero", porque algunos buses empiezan
 * a mitad del recorrido (el primero de la línea 1 sale de Constitución a las 7:10)
 * y otros terminan antes del final.
 */
import type { TimeOfDay } from '../../src/data/schema';

const toMinutes = (t: TimeOfDay) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

interface OpenTrip {
  times: (TimeOfDay | null)[];
  lastIndex: number;
  lastMinutes: number;
}

/**
 * Devuelve un viaje por fila, con una hora (o null) por cada parada de `stopCodes`.
 * Una hora se une a un viaje si ese bus pasó por una parada anterior como mucho
 * `maxGapMin` minutos antes y saltándose como mucho `maxSkippedStops` paradas
 * (un autobús no "desaparece" durante muchas paradas para reaparecer después).
 * Si hay varios candidatos, gana el que pasó más tarde (el que acaba de salir de
 * la parada anterior).
 */
export function buildTrips(
  stopCodes: string[],
  timesByStop: Record<string, TimeOfDay[]>,
  maxGapMin = 15,
  maxSkippedStops = 2,
): (TimeOfDay | null)[][] {
  const trips: OpenTrip[] = [];
  stopCodes.forEach((code, k) => {
    const times = [...(timesByStop[code] ?? [])].sort((a, b) => toMinutes(a) - toMinutes(b));
    for (const t of times) {
      const m = toMinutes(t);
      let best: OpenTrip | undefined;
      for (const trip of trips) {
        const gap = m - trip.lastMinutes;
        const skipped = k - trip.lastIndex - 1;
        if (skipped >= 0 && skipped <= maxSkippedStops && trip.times[k] === null && gap >= 0 && gap <= maxGapMin) {
          if (!best || trip.lastMinutes > best.lastMinutes) best = trip;
        }
      }
      if (!best) {
        best = { times: Array(stopCodes.length).fill(null), lastIndex: -1, lastMinutes: -Infinity };
        trips.push(best);
      }
      best.times[k] = t;
      best.lastIndex = k;
      best.lastMinutes = m;
    }
  });

  const firstMinutes = (trip: OpenTrip) => toMinutes(trip.times.find((t) => t !== null)!);
  return trips.sort((a, b) => firstMinutes(a) - firstMinutes(b)).map((t) => t.times);
}
