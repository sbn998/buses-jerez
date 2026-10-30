// Pruebas del intermediario de rutas a pie: la lógica pura (walk.ts) y el manejador (index.ts),
// con `fetch` y la caché (KV) simulados para no llamar a OpenRouteService de verdad.
import { describe, expect, it, vi } from 'vitest';
import { buildMatrixBody, cacheKey, parseMatrix, validateRequest } from '../src/walk';
import { handle } from '../src/index';

const origin: [number, number] = [-6.1361, 36.6866];
const p1: [number, number] = [-6.11, 36.6705];
const p2: [number, number] = [-6.12, 36.68];
const p3: [number, number] = [-6.13, 36.69];

describe('validateRequest', () => {
  it('acepta una petición correcta', () => {
    expect(validateRequest({ origin, points: [p1], direction: 'from' })).toEqual({
      origin,
      points: [p1],
      direction: 'from',
    });
  });
  it('rechaza un punto fuera de Jerez', () => {
    expect(validateRequest({ origin, points: [[2.17, 41.38]], direction: 'from' })).toBeNull();
  });
  it('acepta justo dentro de la caja y rechaza justo fuera', () => {
    const ok = (pt: [number, number]) =>
      validateRequest({ origin, points: [pt], direction: 'from' }) !== null;
    expect(ok([-6.35, 36.55])).toBe(true);
    expect(ok([-5.85, 36.85])).toBe(true);
    expect(ok([-6.36, 36.7])).toBe(false);
    expect(ok([-5.84, 36.7])).toBe(false);
    expect(ok([-6.1, 36.54])).toBe(false);
    expect(ok([-6.1, 36.86])).toBe(false);
  });
  it('rechaza un origen fuera de la caja', () => {
    expect(validateRequest({ origin: [-6.36, 36.7], points: [p1], direction: 'from' })).toBeNull();
  });
  it('rechaza 11 puntos', () => {
    const points = Array.from({ length: 11 }, () => p1);
    expect(validateRequest({ origin, points, direction: 'from' })).toBeNull();
  });
  it('rechaza una dirección desconocida', () => {
    expect(validateRequest({ origin, points: [p1], direction: 'sideways' })).toBeNull();
  });
  it('rechaza lo que no es un objeto', () => {
    expect(validateRequest(null)).toBeNull();
    expect(validateRequest('hola')).toBeNull();
    expect(validateRequest(42)).toBeNull();
  });
});

describe('cacheKey', () => {
  it('redondea a 4 decimales', () => {
    expect(cacheKey('from', [-6.13614, 36.68659], [-6.11, 36.6705])).toBe(
      'walk/v1/from/-6.1361,36.6866/-6.1100,36.6705',
    );
  });
});

describe('buildMatrixBody', () => {
  it('con from: el origen es la fuente y los puntos que faltan, destinos', () => {
    const body = buildMatrixBody({ origin, points: [p1, p2, p3], direction: 'from' }, [0, 2]);
    expect(body).toEqual({
      locations: [origin, p1, p3],
      sources: [0],
      destinations: [1, 2],
      metrics: ['distance'],
    });
  });
  it('con to: los puntos son las fuentes y el origen, el destino', () => {
    const body = buildMatrixBody({ origin, points: [p1, p2], direction: 'to' }, [0, 1]);
    expect(body).toEqual({
      locations: [origin, p1, p2],
      sources: [1, 2],
      destinations: [0],
      metrics: ['distance'],
    });
  });
});

describe('parseMatrix', () => {
  it('redondea los metros y mantiene los null', () => {
    expect(parseMatrix({ distances: [[120.4, null, 300.6]] }, 3)).toEqual([120, null, 301]);
  });
  it('lee también la forma de columna (dirección to)', () => {
    expect(parseMatrix({ distances: [[10.2], [null], [5.5]] }, 3)).toEqual([10, null, 6]);
  });
  it('devuelve todo null si la respuesta no es válida', () => {
    expect(parseMatrix({}, 2)).toEqual([null, null]);
  });
});

// Caché simulada en memoria (con la misma forma que KV).
function fakeCache(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string, _opts: { expirationTtl: number }) => {
      store.set(key, value);
    }),
  };
}

// `ctx` simulado que recoge las promesas de waitUntil para poder esperarlas.
function fakeCtx() {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    waitUntil: (p: Promise<unknown>) => {
      pending.push(p);
    },
  };
}

function post(body: unknown) {
  return new Request('https://worker.test/walk', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const env = { ORS_API_KEY: 'clave-de-prueba' };
const okOrs = (distances: unknown) =>
  vi.fn(async () => new Response(JSON.stringify({ distances }), { status: 200 }));

describe('handle', () => {
  it('con todo en caché no llama a OpenRouteService', async () => {
    const cache = fakeCache({
      [cacheKey('from', origin, p1)]: '100',
      [cacheKey('from', origin, p2)]: '200',
    });
    const fetchMock = vi.fn();
    const res = await handle(post({ origin, points: [p1, p2], direction: 'from' }), env, fakeCtx(), {
      fetch: fetchMock,
      cache,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ meters: [100, 200] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con 2 de 3 en caché pide solo 1 punto, devuelve los 3 en orden y guarda el nuevo', async () => {
    const cache = fakeCache({
      [cacheKey('from', origin, p1)]: '100',
      [cacheKey('from', origin, p3)]: '300',
    });
    const fetchMock = okOrs([[250.4]]);
    const ctx = fakeCtx();
    const res = await handle(post({ origin, points: [p1, p2, p3], direction: 'from' }), env, ctx, {
      fetch: fetchMock,
      cache,
    });
    expect(await res.json()).toEqual({ meters: [100, 250, 300] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).locations).toEqual([origin, p2]);
    expect(init.signal).toBeDefined();
    await Promise.all(ctx.pending);
    expect(cache.put).toHaveBeenCalledTimes(1);
    expect(cache.put).toHaveBeenCalledWith(cacheKey('from', origin, p2), '250', {
      expirationTtl: 2592000,
    });
  });

  it('un valor corrupto en caché se trata como fallo de caché', async () => {
    const cache = fakeCache({ [cacheKey('from', origin, p1)]: 'basura' });
    const res = await handle(post({ origin, points: [p1], direction: 'from' }), env, fakeCtx(), {
      fetch: okOrs([[42]]),
      cache,
    });
    expect(await res.json()).toEqual({ meters: [42] });
  });

  it('un par sin ruta (null) se devuelve pero no se guarda', async () => {
    const cache = fakeCache();
    const ctx = fakeCtx();
    const res = await handle(post({ origin, points: [p1, p2], direction: 'from' }), env, ctx, {
      fetch: okOrs([[null, 80.2]]),
      cache,
    });
    expect(await res.json()).toEqual({ meters: [null, 80] });
    await Promise.all(ctx.pending);
    expect(cache.put).toHaveBeenCalledTimes(1);
    expect(cache.store.has(cacheKey('from', origin, p1))).toBe(false);
  });

  it('los puntos repetidos se piden una sola vez y se devuelven en su orden', async () => {
    const fetchMock = okOrs([[70, 90]]);
    const res = await handle(
      post({ origin, points: [p1, p2, p1], direction: 'from' }),
      env,
      fakeCtx(),
      { fetch: fetchMock, cache: fakeCache() },
    );
    expect(await res.json()).toEqual({ meters: [70, 90, 70] });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).locations).toEqual([origin, p1, p2]);
  });

  it('si OpenRouteService da 429 responde 502 y no guarda nada', async () => {
    const cache = fakeCache();
    const ctx = fakeCtx();
    const fetchMock = vi.fn(async () => new Response('too many', { status: 429 }));
    const res = await handle(post({ origin, points: [p1], direction: 'from' }), env, ctx, {
      fetch: fetchMock,
      cache,
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 429 });
    expect(ctx.pending).toHaveLength(0);
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('si el fetch lanza un error de red responde 502 y no guarda nada', async () => {
    const cache = fakeCache();
    const ctx = fakeCtx();
    const res = await handle(post({ origin, points: [p1], direction: 'from' }), env, ctx, {
      fetch: vi.fn(async () => {
        throw new Error('red caída');
      }),
      cache,
    });
    expect(res.status).toBe(502);
    expect(ctx.pending).toHaveLength(0);
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('si ORS responde 200 con algo que no es JSON responde 502', async () => {
    const res = await handle(post({ origin, points: [p1], direction: 'from' }), env, fakeCtx(), {
      fetch: vi.fn(async () => new Response('<html>', { status: 200 })),
      cache: fakeCache(),
    });
    expect(res.status).toBe(502);
  });

  it('con GET responde 405', async () => {
    const res = await handle(new Request('https://worker.test/walk'), env, fakeCtx(), {
      fetch: vi.fn(),
      cache: fakeCache(),
    });
    expect(res.status).toBe(405);
  });

  it('con una petición no válida responde 400', async () => {
    const res = await handle(post({ nada: true }), env, fakeCtx(), {
      fetch: vi.fn(),
      cache: fakeCache(),
    });
    expect(res.status).toBe(400);
  });

  it('rechaza con 400 un cuerpo de más de 2048 bytes sin llamar a ORS', async () => {
    const fetchMock = vi.fn();
    const big = JSON.stringify({ origin, points: [p1], direction: 'from', relleno: 'x'.repeat(2100) });
    const res = await handle(post(big), env, fakeCtx(), { fetch: fetchMock, cache: fakeCache() });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rechaza con 400 si Content-Length declara más de 2048', async () => {
    const req = new Request('https://worker.test/walk', {
      method: 'POST',
      headers: { 'content-length': '5000' },
      body: JSON.stringify({ origin, points: [p1], direction: 'from' }),
    });
    const res = await handle(req, env, fakeCtx(), { fetch: vi.fn(), cache: fakeCache() });
    expect(res.status).toBe(400);
  });

  it('cuenta los bytes reales aunque Content-Length mienta o falte', async () => {
    const big = JSON.stringify({ origin, points: [p1], direction: 'from', relleno: 'x'.repeat(2100) });
    const req = new Request('https://worker.test/walk', {
      method: 'POST',
      headers: { 'content-length': '10' },
      body: big,
    });
    const res = await handle(req, env, fakeCtx(), { fetch: vi.fn(), cache: fakeCache() });
    expect(res.status).toBe(400);
  });
});
