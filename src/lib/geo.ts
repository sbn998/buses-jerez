// Cálculos de distancia sobre el mapa: distancia en línea recta entre dos puntos
// y tiempo aproximado andando. Son funciones puras, sin pantallas ni red.

/** Radio medio de la Tierra en metros. */
const RADIO_TIERRA_M = 6371000;

/** Pasa grados a radianes. */
function toRadians(grados: number): number {
  return (grados * Math.PI) / 180;
}

/**
 * Distancia en metros entre dos puntos (lat/lon), en línea recta.
 * Usa la fórmula "haversine", que tiene en cuenta que la Tierra es redonda.
 */
export function distanceMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(h));
}

/**
 * Minutos andando para recorrer `meters` (unos 4,8 km/h: 80 m por minuto).
 * Siempre es al menos 1 minuto, y redondea hacia arriba.
 */
export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.ceil(meters / 80));
}
