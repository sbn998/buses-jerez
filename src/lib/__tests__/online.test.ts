// Pruebas de isOnline: con fetch falso y temporizadores falsos.
import { isOnline } from '../online';

describe('isOnline', () => {
  afterEach(() => jest.useRealTimers());

  it('200 -> true (HEAD sin caché)', async () => {
    const fetchFn = jest.fn(async () => ({ ok: true, status: 200 }) as Response);
    expect(await isOnline(fetchFn as unknown as typeof fetch)).toBe(true);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://sbn998.github.io/buses-jerez/manifest.json');
    expect(init.method).toBe('HEAD');
    expect(init.cache).toBe('no-store');
  });

  it('estado no 2xx -> false', async () => {
    const f = jest.fn(async () => ({ ok: false, status: 503 }) as Response) as unknown as typeof fetch;
    expect(await isOnline(f)).toBe(false);
  });

  it('error lanzado -> false', async () => {
    const f = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    expect(await isOnline(f)).toBe(false);
  });

  it('sin respuesta antes de timeoutMs -> false', async () => {
    jest.useFakeTimers();
    // Un fetch que solo termina (con error) cuando se aborta la señal.
    const f = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          init.signal?.addEventListener('abort', () => rej(new Error('aborted')));
        }),
    ) as unknown as typeof fetch;
    const p = isOnline(f, 5000);
    await jest.advanceTimersByTimeAsync(5000);
    expect(await p).toBe(false);
  });
});
