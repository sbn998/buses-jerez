// Pruebas del lector de la lista de paradas de una línea, usando una respuesta real de Comujesa.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseStopOptions } from '../src/comujesa/parseStops';

const html = readFileSync(new URL('./fixtures/stops-l1.html', import.meta.url), 'utf8');

describe('parseStopOptions', () => {
  it('reads the 20 stops of line 1 in order', () => {
    const stops = parseStopOptions(html);
    expect(stops).toHaveLength(20);
    expect(stops[0]).toEqual({ code: '343', label: 'Plaza Esteve Esteve' });
    expect(stops[1].code).toBe('453');
    expect(stops[13].code).toBe('302');
    expect(stops[19]).toEqual({ code: '130', label: 'Angustias Canal Sur Única' });
  });
});
