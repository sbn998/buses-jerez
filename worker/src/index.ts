// Worker de Cloudflare: recibe POST /walk, mira primero en la caché y solo pregunta a
// OpenRouteService por los pares que faltan. Así la clave de ORS no sale de Cloudflare
// y se gastan pocas peticiones del plan gratuito.
import { buildMatrixBody, cacheKey, parseMatrix, validateRequest } from './walk';

export interface Env {
  ORS_API_KEY: string;
}

// Lo que `handle` necesita del exterior; en las pruebas se sustituye por simulaciones.
export interface Deps {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  cache: {
    match(key: string): Promise<Response | undefined>;
    put(key: string, res: Response): Promise<void>;
  };
}

const ORS_URL = 'https://api.openrouteservice.org/v2/matrix/foot-walking';
const THIRTY_DAYS = 2592000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Atiende una petición. Devuelve los metros a pie de cada punto, en el mismo orden que llegaron.
export async function handle(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  deps: Deps,
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'método no permitido' }, 405);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'petición no válida' }, 400);
  }
  const req = validateRequest(body);
  if (!req) return json({ error: 'petición no válida' }, 400);

  // 1. Buscar cada par en la caché.
  const meters: (number | null)[] = Array(req.points.length).fill(null);
  const keys = req.points.map((p) => cacheKey(req.direction, req.origin, p));
  const missing: number[] = [];
  await Promise.all(
    keys.map(async (key, i) => {
      const hit = await deps.cache.match(key);
      if (hit) {
        const data = (await hit.json()) as { meters: number };
        meters[i] = data.meters;
      } else {
        missing.push(i);
      }
    }),
  );
  missing.sort((a, b) => a - b);

  // 2. Pedir a OpenRouteService solo los que faltan.
  if (missing.length > 0) {
    let res: Response;
    try {
      res = await deps.fetch(ORS_URL, {
        method: 'POST',
        headers: { Authorization: env.ORS_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify(buildMatrixBody(req, missing)),
      });
    } catch {
      return json({ error: 'sin conexión con OpenRouteService' }, 502);
    }
    if (!res.ok) return json({ error: res.status }, 502);

    const fresh = parseMatrix(await res.json(), missing.length);
    missing.forEach((pointIdx, k) => {
      const value = fresh[k];
      meters[pointIdx] = value;
      // Los null (sin ruta) no se guardan, por si es un fallo temporal.
      if (value !== null) {
        const entry = new Response(JSON.stringify({ meters: value }), {
          headers: { 'Cache-Control': `max-age=${THIRTY_DAYS}` },
        });
        ctx.waitUntil(deps.cache.put(keys[pointIdx], entry));
      }
    });
  }

  return json({ meters });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handle(request, env, ctx, {
      fetch: (url, init) => fetch(url, init),
      cache: caches.default as unknown as Deps['cache'],
    });
  },
};
