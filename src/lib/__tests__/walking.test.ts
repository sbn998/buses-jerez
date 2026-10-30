// Pruebas del cliente del Worker de rutas a pie (src/lib/walking.ts).
import type { Stop } from '@/data/schema';

const origen = { lat: 36.68, lon: -6.13 };
const parada = (code: string, lat: number, lon: number): Stop => ({
  code, name: code, description: '', lat, lon, coordSource: 'kml',
});
const paradas = [parada('S1', 36.681, -6.131), parada('S2', 36.682, -6.132), parada('S3', 36.683, -6.133)];

/** Carga el módulo con (o sin) URL configurada. */
function cargar(url: string) {
  let mod!: typeof import('@/lib/walking');
  jest.isolateModules(() => {
    process.env.EXPO_PUBLIC_WALK_API_URL = url;
    mod = require('@/lib/walking');
  });
  return mod;
}

const respuesta = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

afterEach(() => {
  delete process.env.EXPO_PUBLIC_WALK_API_URL;
  jest.useRealTimers();
});

describe('fetchWalks', () => {
  it('manda el cuerpo esperado ([lon, lat]) y quita los null', async () => {
    const { fetchWalks } = cargar('https://worker.test/walk');
    const fetchFn = jest.fn().mockResolvedValue(respuesta(200, { meters: [420, null, 900] }));
    const res = await fetchWalks(origen, paradas, 'from', fetchFn);
    expect(res).toEqual({ S1: 420, S3: 900 });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://worker.test/walk');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      origin: [-6.13, 36.68],
      points: [[-6.131, 36.681], [-6.132, 36.682], [-6.133, 36.683]],
      direction: 'from',
    });
  });

  it('manda como mucho 10 paradas', async () => {
    const { fetchWalks } = cargar('https://worker.test/walk');
    const muchas = Array.from({ length: 12 }, (_, i) => parada(`P${i}`, 36.68, -6.13));
    const fetchFn = jest.fn().mockResolvedValue(respuesta(200, { meters: muchas.slice(0, 10).map(() => 1) }));
    const res = await fetchWalks(origen, muchas, 'to', fetchFn);
    expect(JSON.parse(fetchFn.mock.calls[0][1].body).points).toHaveLength(10);
    expect(Object.keys(res!)).toHaveLength(10);
  });

  it('manda direction "to" y el origen tal cual', async () => {
    const { fetchWalks } = cargar('https://worker.test/walk');
    const fetchFn = jest.fn().mockResolvedValue(respuesta(200, { meters: [1, 2, 3] }));
    await fetchWalks(origen, paradas, 'to', fetchFn);
    const cuerpo = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(cuerpo.direction).toBe('to');
    expect(cuerpo.origin).toEqual([-6.13, 36.68]);
  });

  it('da null si meters no tiene un valor por parada', async () => {
    const { fetchWalks } = cargar('https://worker.test/walk');
    const corto = jest.fn().mockResolvedValue(respuesta(200, { meters: [420] }));
    expect(await fetchWalks(origen, paradas, 'from', corto)).toBeNull();
    const noArray = jest.fn().mockResolvedValue(respuesta(200, { meters: 5 }));
    expect(await fetchWalks(origen, paradas, 'from', noArray)).toBeNull();
  });

  it('descarta valores negativos o no numericos', async () => {
    const { fetchWalks } = cargar('https://worker.test/walk');
    const fetchFn = jest.fn().mockResolvedValue(respuesta(200, { meters: [-5, 'x', 0] }));
    expect(await fetchWalks(origen, paradas, 'from', fetchFn)).toEqual({ S3: 0 });
  });

  it('da null con un estado 500', async () => {
    const { fetchWalks } = cargar('https://worker.test/walk');
    const fetchFn = jest.fn().mockResolvedValue(respuesta(500, {}));
    expect(await fetchWalks(origen, paradas, 'from', fetchFn)).toBeNull();
  });

  it('da null si fetch lanza un error', async () => {
    const { fetchWalks } = cargar('https://worker.test/walk');
    const fetchFn = jest.fn().mockRejectedValue(new Error('sin red'));
    expect(await fetchWalks(origen, paradas, 'from', fetchFn)).toBeNull();
  });

  it('da null al agotar el tiempo', async () => {
    jest.useFakeTimers();
    const { fetchWalks } = cargar('https://worker.test/walk');
    // Un fetch que nunca responde, pero que falla al abortarse.
    const fetchFn = jest.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_ok, fail) => {
        init.signal!.addEventListener('abort', () => fail(new Error('abortado')));
      }),
    );
    const promesa = fetchWalks(origen, paradas, 'from', fetchFn as unknown as typeof fetch, 4000);
    jest.advanceTimersByTime(4000);
    expect(await promesa).toBeNull();
  });

  it('da null sin llamar a fetch si no hay URL', async () => {
    const { fetchWalks } = cargar('');
    const fetchFn = jest.fn();
    expect(await fetchWalks(origen, paradas, 'from', fetchFn)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
