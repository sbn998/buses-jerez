// Pruebas del lector de la página de una línea (sentidos y mapa incrustado), con páginas reales.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLinePage } from '../src/comujesa/parseLinePage';

const read = (f: string) => readFileSync(new URL('./fixtures/' + f, import.meta.url), 'utf8');

describe('parseLinePage', () => {
  it('reads map id and both directions of line 1', () => {
    const page = parseLinePage(read('line-1.html'));
    expect(page.mapId).toBe('1cVe0lNVcBPY5RMtt-wSR3Ltl2hAVXcoo');
    expect(page.directions).toHaveLength(2);
    expect(page.directions[0].headsign).toBe('San Telmo');
    expect(page.directions[0].stopNames).toHaveLength(15);
    expect(page.directions[0].stopNames[0]).toBe('Plaza Esteve Esteve');
    expect(page.directions[1].headsign).toBe('Plaza Esteve');
    expect(page.directions[1].stopNames).toHaveLength(5);
    expect(page.directions[1].stopNames[4]).toBe('Angustias Canal Sur');
  });

  it('reads map id when the iframe uses /u/1/', () => {
    expect(parseLinePage(read('line-2.html')).mapId).toBe('18tZAxIVFY_tVF2exK55pZdONHem_zlmC');
  });
});
