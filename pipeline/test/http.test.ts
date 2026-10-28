// Pruebas del cliente HTTP: reintenta si la web falla, se identifica y no satura a Comujesa.
import { describe, expect, it } from 'vitest';
import { createClient } from '../src/http';

/** Crea un "fetch" falso que devuelve, por orden, los códigos de estado indicados. */
function fakeFetch(statuses: number[], body = 'ok') {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)];
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('createClient', () => {
  it('retries then succeeds', async () => {
    const { fetchImpl, calls } = fakeFetch([500, 500, 200]);
    const client = createClient({ fetchImpl, delayMs: 0, retryDelaysMs: [0, 0, 0] });
    await expect(client.getText('https://x.test/a')).resolves.toBe('ok');
    expect(calls).toHaveLength(3);
  });

  it('throws after retries', async () => {
    const { fetchImpl, calls } = fakeFetch([500]);
    const client = createClient({ fetchImpl, delayMs: 0, retryDelaysMs: [0, 0, 0] });
    await expect(client.getText('https://x.test/b')).rejects.toThrow('https://x.test/b');
    expect(calls).toHaveLength(4);
  });

  it('sends user agent and form', async () => {
    const { fetchImpl, calls } = fakeFetch([200]);
    const client = createClient({ fetchImpl, delayMs: 0, retryDelaysMs: [] });
    await client.postForm('https://x.test/c', { valorLinea: '1' });
    const init = calls[0].init!;
    const headers = new Headers(init.headers);
    expect(init.method).toBe('POST');
    expect(String(init.body)).toBe('valorLinea=1');
    expect(headers.get('content-type')).toBe('application/x-www-form-urlencoded');
    expect(headers.get('user-agent')).toBe(
      'buses-jerez-data/1.0 (+https://github.com/sbn998/buses-jerez)',
    );
  });

  it('throttles', async () => {
    const { fetchImpl } = fakeFetch([200]);
    const client = createClient({ fetchImpl, delayMs: 50, retryDelaysMs: [] });
    await client.getText('https://x.test/d');
    const start = Date.now();
    await client.getText('https://x.test/e');
    expect(Date.now() - start).toBeGreaterThanOrEqual(45);
  });
});
