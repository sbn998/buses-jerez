// Pruebas de la caché del OCR: cuándo se reutiliza un resultado y cuándo hay que volver a leer.
import { describe, expect, it } from 'vitest';
import { decide, fetchPreviousOcr, headPdf, type CachedPdf } from '../src/pdf/ocrCache';
import type { PdfSource } from '../src/pdf/sources';

const source: PdfSource = { file: 'LINEA_1_LAB.pdf', url: 'https://x/LINEA_1_LAB.pdf', lineId: '1', dayType: 'lab' };
const cached: CachedPdf = {
  file: 'LINEA_1_LAB.pdf',
  lastModified: 'Mon, 01 Jan 2026 00:00:00 GMT',
  contentLength: '1000',
  sha256: 'abc',
  result: { validFrom: null, validTo: null, periodName: null, legend: [], marks: [], unreadable: [], warnings: [] },
};
const same = { lastModified: cached.lastModified, contentLength: cached.contentLength };

describe('decide', () => {
  it('reuses the cache when the headers are the same', () => {
    expect(decide(source, same, cached)).toBe('reuse');
  });

  it('reads again when Last-Modified or Content-Length changed', () => {
    expect(decide(source, { ...same, lastModified: 'Tue, 02 Feb 2026 00:00:00 GMT' }, cached)).toBe('ocr');
    expect(decide(source, { ...same, contentLength: '2000' }, cached)).toBe('ocr');
  });

  it('reads again when there is no cache or the server gives no headers', () => {
    expect(decide(source, same, undefined)).toBe('ocr');
    const empty = { lastModified: null, contentLength: null };
    expect(decide(source, empty, { ...cached, ...empty })).toBe('ocr');
  });

  it('reuses cached result when HEAD fails', () => {
    expect(decide(source, null, cached)).toBe('reuse');
  });

  it('is an error when HEAD fails and there is no cache', () => {
    const d = decide(source, null, undefined);
    expect(typeof d).toBe('object');
    expect((d as { error: string }).error).toContain('LINEA_1_LAB.pdf');
  });

  it('uses the manual entry when there is one', () => {
    expect(decide(source, same, cached, cached)).toBe('manual');
  });
});

describe('headPdf', () => {
  it('returns the headers, or null when the request fails', async () => {
    const ok = (async () =>
      new Response(null, { headers: { 'last-modified': 'L', 'content-length': '5' } })) as unknown as typeof fetch;
    expect(await headPdf('https://x', ok)).toEqual({ lastModified: 'L', contentLength: '5' });
    const bad = (async () => new Response(null, { status: 500 })) as unknown as typeof fetch;
    expect(await headPdf('https://x', bad)).toBeNull();
    const boom = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await headPdf('https://x', boom)).toBeNull();
  });
});

describe('fetchPreviousOcr', () => {
  it('treats 404 as an empty cache and other failures as errors', async () => {
    const f = (res: Response) => (async () => res) as unknown as typeof fetch;
    expect(await fetchPreviousOcr(f(new Response('', { status: 404 })))).toEqual({ ok: true, cache: {} });
    expect((await fetchPreviousOcr(f(new Response('', { status: 500 })))).ok).toBe(false);
    expect((await fetchPreviousOcr(f(new Response('{"a":1}')))).ok).toBe(true);
  });
});
