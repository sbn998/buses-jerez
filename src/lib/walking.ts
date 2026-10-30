// Cliente del intermediario (Cloudflare Worker) que calcula distancias reales andando por calles.
// Si no hay URL, hay error o tarda demasiado, devuelve null y la app sigue con la estimación en línea recta.
import type { Stop } from '@/data/schema';
import type { LatLon } from '@/lib/planner';

/**
 * URL del Worker. Vacía hasta que se despliegue (Task 4): entonces no se pide nada.
 * Se puede fijar con la variable EXPO_PUBLIC_WALK_API_URL (así también se prueba con una URL).
 */
export const WALK_API_URL = process.env.EXPO_PUBLIC_WALK_API_URL ?? '';

/** El Worker acepta como máximo 10 puntos por petición. */
const MAX_POINTS = 10;

/**
 * Pide los metros andando entre `origin` y cada parada.
 * - 'from': del origen a la parada; 'to': de la parada al origen (el origen es el destino del viaje).
 * Devuelve { códigoDeParada: metros }, sin las paradas que no tienen ruta, o null si algo falla.
 */
export async function fetchWalks(
  origin: LatLon,
  stops: Stop[],
  direction: 'from' | 'to',
  fetchFn: typeof fetch = fetch,
  timeoutMs = 4000,
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
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { meters?: (number | null)[] };
    if (!Array.isArray(body.meters)) return null;
    const result: Record<string, number> = {};
    sent.forEach((stop, i) => {
      const m = body.meters![i];
      if (typeof m === 'number') result[stop.code] = m;
    });
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
