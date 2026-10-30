// Pruebas del intermediario de rutas a pie: la lógica pura (walk.ts) y el manejador (index.ts),
// con `fetch` y la caché simulados para no llamar a OpenRouteService de verdad.
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
      'https://cache.local/walk/v1/from/-6.1361,36.6866/-6.1100,36.6705',
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
    const json = { distances: [[120.4, null, 300.6]] };
    expect(parseMatrix(json, 3)).toEqual([120, null, 301]);
  });
  it('lee también la forma de columna (dirección to)', () => {
    const json = { distances: [[10.2], [null]] };
    expect(parseMatrix(json, 2)).toEqual([10, null]);
  });
  it('devuelve todo null si la respuesta no es válida', () => {
    expect(parseMatrix({}, 2)).toEqual([null, null]);
  });
});

// Caché simulada en memoria.
function fakeCache(initial: Record<string, number> = {}) {
  const store = new Map<string, Response>();
  for (const [k, v] of Object.entries(initial)) {
    store.set(k, new Response(JSON.stringify({ meters: v })));
  }
  return {
    store,
    match: vi.fn(async (key: string) => store.get(key)?.clone()),
    put: vi.fn(async (key: string, res: Response) => {
      store.set(key, res);
    }),
  };
}

function post(body: unknown) {
  return new Request('https://worker.test/walk', { method: 'POST', body: JSON.stringify(body) });
}
const env = { ORS_API_KEY: 'clave-de-prueba' };
const ctx = { waitUntil: (p: Promise<unknown>) => void p.catch(() => {}) } as unknown as ExecutionContext;

describe('handle', () => {
  it('con todo en caché no llama a OpenRouteService', async () => {
    const cache = fakeCache({
      [cacheKey('from', origin, p1)]: 100,
      [cacheKey('from', origin, p2)]: 200,
    });
    const fetchMock = vi.fn();
    const res = await handle(post({ origin, points: [p1, p2], direction: 'from' }), env, ctx, {
      fetch: fetchMock,
      cache,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ meters: [100, 200] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con 2 de 3 en caché pide solo 1 punto y devuelve los 3 en orden', async () => {
    const cache = fakeCache({
      [cacheKey('from', origin, p1)]: 100,
      [cacheKey('from', origin, p3)]: 300,
    });
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ distances: [[250.4]] }), { status: 200 }),
    );
    const res = await handle(post({ origin, points: [p1, p2, p3], direction: 'from' }), env, ctx, {
      fetch: fetchMock,
      cache,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ meters: [100, 250, 300] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).locations).toEqual([origin, p2]);
    // El nuevo resultado queda guardado en caché.
    await Promise.resolve();
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it('si OpenRouteService da 429 responde 502 y no guarda nada', async () => {
    const cache = fakeCache();
    const fetchMock = vi.fn(async () => new Response('too many', { status: 429 }));
    const res = await handle(post({ origin, points: [p1], direction: 'from' }), env, ctx, {
      fetch: fetchMock,
      cache,
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 429 });
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('con GET responde 405', async () => {
    const res = await handle(new Request('https://worker.test/walk'), env, ctx, {
      fetch: vi.fn(),
      cache: fakeCache(),
    });
    expect(res.status).toBe(405);
  });

  it('con una petición no válida responde 400', async () => {
    const res = await handle(post({ nada: true }), env, ctx, { fetch: vi.fn(), cache: fakeCache() });
    expect(res.status).toBe(400);
  });
});
