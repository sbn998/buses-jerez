// Pruebas del lector de horas de paso, usando la respuesta real de la línea 1 en Plaza Esteve.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTimes } from '../src/comujesa/parseTimes';

const html = readFileSync(new URL('./fixtures/times-l1-343.html', import.meta.url), 'utf8');

describe('parseTimes', () => {
  it('reads weekday, saturday and holiday times', () => {
    const t = parseTimes(html);
    expect(t.lab).toHaveLength(29);
    expect(t.lab[0]).toBe('07:28');
    expect(t.lab[28]).toBe('21:38');
    expect(t.sab).toHaveLength(16);
    expect(t.sab[0]).toBe('07:40');
    expect(t.sab[15]).toBe('22:00');
    expect(t.fes).toHaveLength(10);
    expect(t.fes[0]).toBe('09:00');
    expect(t.fes[9]).toBe('21:40');
  });

  it('returns empty lists for an empty page', () => {
    expect(parseTimes('<html></html>')).toEqual({ lab: [], sab: [], fes: [] });
  });
});
