// Cliente del intermediario (Cloudflare Worker) que calcula distancias reales andando por calles.
// Si no hay URL, hay error o tarda demasiado, devuelve null y la app sigue con la estimación en línea recta.
import type { Stop } from '@/data/schema';
import type { LatLon } from '@/lib/planner';

/**
 * URL del Worker publicado en Cloudflare (ver worker/README.md). No es secreta.
 * Se puede cambiar con la variable EXPO_PUBLIC_WALK_API_URL; si vale '', no se pide nada.
 */
export const DEFAULT_WALK_API_URL = 'https://buses-jerez-walk.buses-jerez-walk.workers.dev/walk';
export const WALK_API_URL = process.env.EXPO_PUBLIC_WALK_API_URL ?? DEFAULT_WALK_API_URL;

/** El Worker acepta como máximo 10 puntos por petición. */
const MAX_POINTS = 10;

/**
 * Pide los metros andando entre `origin` y cada parada.
 * - 'from': del origen a la parada; 'to': de la parada al origen (el origen es el destino del viaje).
 * - options.store === false: el Worker no guarda ni lee su caché para esta petición (se usa con la
 *   ubicación GPS del usuario, que no debe quedar guardada).
 * Devuelve { códigoDeParada: metros }, sin las paradas que no tienen ruta, o null si algo falla.
 */
export async function fetchWalks(
  origin: LatLon,
  stops: Stop[],
  direction: 'from' | 'to',
  fetchFn: typeof fetch = fetch,
  timeoutMs = 4000,
  options: { store?: boolean } = {},
): Promise<Record<string, number> | null> {
  if (!WALK_API_URL) return null;
  const sent = stops.slice(0, MAX_POINTS);
  // AbortController corta la petición si pasa el tiempo máximo.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(WALK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // El Worker espera [lon, lat], al revés que LatLon.
      body: JSON.stringify({
        origin: [origin.lon, origin.lat],
        points: sent.map((s) => [s.lon, s.lat]),
        direction,
        // Solo se manda cuando es false (por defecto el Worker guarda en caché).
        ...(options.store === false ? { store: false } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { meters?: (number | null)[] };
    // La respuesta debe traer un valor por parada enviada; si no, no nos fiamos.
    if (!Array.isArray(body.meters) || body.meters.length !== sent.length) return null;
    const result: Record<string, number> = {};
    sent.forEach((stop, i) => {
      const m = body.meters![i];
      if (typeof m === 'number' && Number.isFinite(m) && m >= 0) result[stop.code] = m;
    });
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
