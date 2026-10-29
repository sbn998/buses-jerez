// Paradas cercanas: dado un punto (por ejemplo, la posición del móvil), busca las
// paradas a menos de 500 m que salen en alguna línea, ordenadas por distancia.
// Si no hay ninguna en ese radio, devuelve las más cercanas aunque estén lejos.
// Es lógica pura: no hay pantallas ni red, así que funciona sin internet.
import type { Dataset, Line, Stop } from '@/data/schema';
import { distanceMeters, walkingMinutes } from '@/lib/geo';

/** Una parada cercana, con su distancia, el tiempo andando y las líneas que pasan por ella. */
export interface NearbyStop {
  stop: Stop;
  meters: number;
  minutes: number;
  /** Líneas que pasan por la parada, ordenadas por número de línea. */
  lines: Line[];
}

/**
 * Paradas a menos de `radius` metros de `from`, de la más cercana a la más lejana.
 * Si no hay ninguna, devuelve las `fallbackCount` más cercanas con `withinRadius: false`.
 * Solo se cuentan las paradas que salen en al menos una línea.
 */
export function nearbyStops(
  data: Dataset,
  from: { lat: number; lon: number },
  radius = 500,
  fallbackCount = 3,
): { items: NearbyStop[]; withinRadius: boolean } {
  // Ordenamos las líneas por número ("2" antes que "10"), no por texto.
  const lines = [...data.lines].sort((a, b) => Number(a.id) - Number(b.id));

  // Todas las paradas con su distancia, dejando fuera las que no salen en ninguna línea.
  const todas: NearbyStop[] = [];
  for (const stop of Object.values(data.stops)) {
    const lineasDeParada = lines.filter((l) => l.stopCodes.includes(stop.code));
    if (lineasDeParada.length === 0) continue;
    const meters = distanceMeters(from, stop);
    todas.push({ stop, meters, minutes: walkingMinutes(meters), lines: lineasDeParada });
  }
  todas.sort((a, b) => a.meters - b.meters);

  const dentro = todas.filter((p) => p.meters < radius);
  if (dentro.length > 0) return { items: dentro, withinRadius: true };
  return { items: todas.slice(0, fallbackCount), withinRadius: false };
}
