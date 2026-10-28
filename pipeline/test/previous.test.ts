// Pruebas de la descarga de la versión publicada anterior.
import { describe, expect, it } from 'vitest';
import { fetchPrevious } from '../src/previous';

const fakeFetch = (res: Response | Error) =>
  (async () => {
    if (res instanceof Error) throw res;
    return res;
  }) as unknown as typeof fetch;

describe('fetchPrevious', () => {
  it('returns the dataset when it exists', async () => {
    const r = await fetchPrevious(fakeFetch(new Response('{"schemaVersion":1}', { status: 200 })));
    expect(r).toEqual({ ok: true, previous: { schemaVersion: 1 } });
  });

  it('returns null only on 404 (first run)', async () => {
    expect(await fetchPrevious(fakeFetch(new Response('', { status: 404 })))).toEqual({ ok: true, previous: null });
  });

  it('fails on server errors, network errors and bad JSON', async () => {
    expect((await fetchPrevious(fakeFetch(new Response('', { status: 503 })))).ok).toBe(false);
    expect((await fetchPrevious(fakeFetch(new Error('offline')))).ok).toBe(false);
    expect((await fetchPrevious(fakeFetch(new Response('<html>', { status: 200 })))).ok).toBe(false);
  });
});
