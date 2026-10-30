// Lógica pura del intermediario de rutas a pie: validar la petición, construir la clave de caché,
// preparar la petición a OpenRouteService e interpretar su respuesta. No usa red ni caché,
// por eso es fácil de probar.

export type LonLat = [number, number];
export type Direction = 'from' | 'to';

export interface WalkRequest {
  origin: LonLat;
  points: LonLat[];
  direction: Direction;
  // false = no leer ni guardar en la caché (se usa con la ubicación GPS del usuario, que es privada).
  store: boolean;
}

// Máximo de puntos por petición (límite de la matriz gratuita y para evitar abusos).
export const MAX_POINTS = 10;

// Caja que rodea Jerez de la Frontera: fuera de ella no se calcula nada.
// OJO: debe coincidir con JEREZ_BOUNDS de la app (src/lib/mapLayers.ts).
const BOUNDS = { minLon: -6.35, minLat: 36.55, maxLon: -5.85, maxLat: 36.85 };

// Comprueba que algo es una pareja [lon, lat] válida y dentro de Jerez.
function isLonLat(v: unknown): v is LonLat {
  if (!Array.isArray(v) || v.length !== 2) return false;
  const [lon, lat] = v;
  return (
    typeof lon === 'number' &&
    typeof lat === 'number' &&
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    lon >= BOUNDS.minLon &&
    lon <= BOUNDS.maxLon &&
    lat >= BOUNDS.minLat &&
    lat <= BOUNDS.maxLat
  );
}

// Devuelve la petición ya tipada, o null si algo no cuadra.
export function validateRequest(body: unknown): WalkRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const { origin, points, direction, store } = body as Record<string, unknown>;
  if (direction !== 'from' && direction !== 'to') return null;
  if (!isLonLat(origin)) return null;
  if (!Array.isArray(points) || points.length === 0 || points.length > MAX_POINTS) return null;
  if (!points.every(isLonLat)) return null;
  // `store` es opcional (por defecto true), pero si viene tiene que ser un booleano.
  if (store !== undefined && typeof store !== 'boolean') return null;
  return { origin, points: points as LonLat[], direction, store: store !== false };
}

// Clave de caché de un par origen-punto. Se redondea a 4 decimales (unos 10 m)
// para que paradas y búsquedas muy cercanas compartan resultado.
export function cacheKey(direction: Direction, origin: LonLat, point: LonLat): string {
  const fmt = (p: LonLat) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
  return `walk/v1/${direction}/${fmt(origin)}/${fmt(point)}`;
}

// Cuerpo de la petición a OpenRouteService solo con los puntos que faltan en caché.
// locations[0] es el origen; después van los puntos que faltan, en orden.
export function buildMatrixBody(req: WalkRequest, missing: number[]): object {
  const locations = [req.origin, ...missing.map((i) => req.points[i])];
  const pointIdx = missing.map((_, k) => k + 1);
  return {
    locations,
    sources: req.direction === 'from' ? [0] : pointIdx,
    destinations: req.direction === 'from' ? pointIdx : [0],
    metrics: ['distance'],
  };
}

// Lee la matriz de distancias de ORS y devuelve `count` metros redondeados (null si no hay ruta).
// En dirección "from" llega una fila; en "to", una columna.
export function parseMatrix(json: unknown, count: number): (number | null)[] {
  const out: (number | null)[] = Array(count).fill(null);
  const rows = (json as { distances?: unknown } | null)?.distances;
  if (!Array.isArray(rows)) return out;
  const flat: unknown[] =
    rows.length === 1 && Array.isArray(rows[0]) ? rows[0] : rows.map((r) => (Array.isArray(r) ? r[0] : null));
  for (let i = 0; i < count; i++) {
    const v = flat[i];
    out[i] = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;
  }
  return out;
}
