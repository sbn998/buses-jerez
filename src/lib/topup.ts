// Ordena los puntos de recarga por zonas para mostrarlos en la pantalla Recarga.
import type { Dataset, TopUpPoint } from '@/data/schema';

/** Orden en que se enseñan las zonas: primero las oficinas de Comujesa. */
const ZONE_ORDER: TopUpPoint['zone'][] = ['oficina', 'centro', 'norte', 'este', 'oeste', 'sur'];

/** Un grupo de puntos de la misma zona. */
export interface TopUpGroup {
  zone: TopUpPoint['zone'];
  points: TopUpPoint[];
}

/** Agrupa los puntos por zona, en el orden de ZONE_ORDER y sin zonas vacías. Dentro de cada zona se respeta el orden original. */
export function groupTopUp(points: TopUpPoint[]): TopUpGroup[] {
  return ZONE_ORDER.map((zone) => ({ zone, points: points.filter((p) => p.zone === zone) })).filter(
    (g) => g.points.length > 0,
  );
}

/** Página oficial de Comujesa con los puntos de venta y recarga. */
export const TOPUP_URL = 'https://www.comujesa.es/autobuses-urbanos/punto-venta-multiviaje';

/**
 * Puntos de recarga y fecha de revisión que debe enseñar la pantalla.
 * Si los datos descargados son antiguos y no traen puntos, se usa la copia incluida en la app.
 * Puntos y fecha van siempre juntos de la misma fuente, para no mezclar una fecha con la lista de otra.
 */
export function topUpFor(
  data: Pick<Dataset, 'topUpPoints' | 'topUpChecked'>,
  bundled: Pick<Dataset, 'topUpPoints' | 'topUpChecked'>,
): { points: TopUpPoint[] | undefined; checked: string | undefined } {
  const source = data.topUpPoints ? data : bundled;
  return { points: source.topUpPoints, checked: source.topUpChecked };
}

/**
 * Convierte "AAAA-MM-DD" en una fecha legible. Devuelve null si el texto no es una fecha real,
 * para que la pantalla omita "revisado el …" en vez de escribir "Invalid Date".
 */
export function formatCheckedDate(text: string | undefined, language: string): string | null {
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [y, m, d] = text.split('-').map(Number);
  // Se construye a mano para que la zona horaria no cambie el día.
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date.toLocaleDateString(language);
}
