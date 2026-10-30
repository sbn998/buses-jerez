// Worker de Cloudflare: recibe POST /walk, mira primero en la caché (Workers KV) y solo pregunta a
// OpenRouteService por los pares que faltan. Así la clave de ORS no sale de Cloudflare
// y se gastan pocas peticiones del plan gratuito.
import { buildMatrixBody, cacheKey, parseMatrix, validateRequest } from './walk';

export interface Env {
  ORS_API_KEY: string;
  // Almacén clave-valor de Cloudflare donde se guardan los metros ya calculados.
  WALK_CACHE: KVNamespace;
}

// Lo que `handle` necesita del exterior; en las pruebas se sustituye por simulaciones.
// KV cumple la parte `cache` tal cual.
export interface Deps {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  cache: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, opts: { expirationTtl: number }): Promise<void>;
  };
}

const ORS_URL = 'https://api.openrouteservice.org/v2/matrix/foot-walking';
const THIRTY_DAYS = 2592000;
const MAX_BODY_BYTES = 2048;
// Menos que los 4 s de la app: así lo que llega a tiempo a la app también se alcanza a guardar.
const ORS_TIMEOUT_MS = 3500;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Lee el cuerpo como texto y se rinde (null) si pasa de 2 KB. No se fía de la cabecera
// Content-Length (puede faltar o mentir): cuenta los bytes reales mientras llegan.
async function readBodyLimited(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

// Atiende una petición. Devuelve los metros a pie de cada punto, en el mismo orden que llegaron.
export async function handle(
  request: Request,
  env: Pick<Env, 'ORS_API_KEY'>,
  ctx: Pick<ExecutionContext, 'waitUntil'>,
  deps: Deps,
): Promise<Response> {
  // Solo existe la ruta /walk, y solo con POST.
  if (new URL(request.url).pathname !== '/walk') return json({ error: 'no encontrado' }, 404);
  if (request.method !== 'POST') return json({ error: 'método no permitido' }, 405);

  const text = await readBodyLimited(request);
  if (text === null) return json({ error: 'petición no válida' }, 400);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'petición no válida' }, 400);
  }
  const req = validateRequest(body);
  if (!req) return json({ error: 'petición no válida' }, 400);

  // 1. Buscar cada par en la caché. Un valor que no sea un número válido cuenta como "no está".
  const meters: (number | null)[] = Array(req.points.length).fill(null);
  const keys = req.points.map((p) => cacheKey(req.direction, req.origin, p));
  await Promise.all(
    keys.map(async (key, i) => {
      // Con store=false (ubicación GPS del usuario) no se mira la caché.
      if (!req.store) return;
      try {
        const raw = await deps.cache.get(key);
        const n = raw === null || raw === '' ? NaN : Number(raw);
        if (Number.isFinite(n) && n >= 0) meters[i] = n;
      } catch {
        // Si la caché falla, se trata como si el dato no estuviera.
      }
    }),
  );

  // Puntos que faltan, agrupados por clave: los repetidos se piden una sola vez.
  const missingByKey = new Map<string, number[]>();
  keys.forEach((key, i) => {
    if (meters[i] === null) {
      const list = missingByKey.get(key) ?? [];
      list.push(i);
      missingByKey.set(key, list);
    }
  });

  // 2. Pedir a OpenRouteService solo los que faltan (uno por clave distinta).
  if (missingByKey.size > 0) {
    const groups = [...missingByKey.entries()];
    const representatives = groups.map(([, idxs]) => idxs[0]);
    let fresh: (number | null)[];
    try {
      const res = await deps.fetch(ORS_URL, {
        method: 'POST',
        headers: { Authorization: env.ORS_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify(buildMatrixBody(req, representatives)),
        signal: AbortSignal.timeout(ORS_TIMEOUT_MS),
      });
      if (!res.ok) return json({ error: res.status }, 502);
      fresh = parseMatrix(await res.json(), groups.length);
    } catch {
      // Red caída, tiempo agotado o respuesta que no es JSON: no se guarda nada.
      return json({ error: 'OpenRouteService no responde' }, 502);
    }
    groups.forEach(([key, idxs], k) => {
      const value = fresh[k];
      for (const i of idxs) meters[i] = value;
      // Los null (sin ruta) no se guardan, por si es un fallo temporal.
      // Con store=false tampoco se guarda nada: la posición del usuario no queda en KV.
      if (value !== null && req.store) {
        ctx.waitUntil(deps.cache.put(key, String(value), { expirationTtl: THIRTY_DAYS }));
      }
    });
  }

  return json({ meters });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handle(request, env, ctx, {
      fetch: (url, init) => fetch(url, init),
      cache: env.WALK_CACHE,
    });
  },
};
