// Ordena los puntos de recarga por zonas para mostrarlos en la pantalla Recarga.
import type { TopUpPoint } from '@/data/schema';

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
