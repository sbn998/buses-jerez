// Pruebas del manifiesto: la "versión" solo cambia si cambian los datos, no la fecha.
import { describe, expect, it } from 'vitest';
import type { Dataset } from '../../src/data/schema';
import { makeManifest } from '../src/manifest';

const dataset = (generatedAt: string, time = '07:00'): Dataset => ({
  schemaVersion: 1,
  generatedAt,
  lines: [{
    id: '1', name: 'L', colour: '#000', stopCodes: ['1'], directions: [], shapes: [],
    timesByStop: { '1': { lab: [time], sab: [], fes: [] } }, trips: { lab: [], sab: [], fes: [] },
  }],
  stops: {},
  holidays: [],
});

describe('makeManifest', () => {
  it('same content with different date gives same version', () => {
    const a = makeManifest(dataset('2026-10-28T04:00:00Z'));
    const b = makeManifest(dataset('2026-10-29T04:00:00Z'));
    expect(a.version).toBe(b.version);
    expect(a.version).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatchObject({ schemaVersion: 1, generatedAt: '2026-10-29T04:00:00Z', dataUrl: 'data.json' });
  });

  it('changing a time changes the version', () => {
    expect(makeManifest(dataset('x')).version).not.toBe(makeManifest(dataset('x', '07:05')).version);
  });
});
