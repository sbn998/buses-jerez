// Pruebas del ensamblado: cómo se juntan paradas, horas, sentidos y mapa de cada línea.
import { describe, expect, it } from 'vitest';
import { assemble, normalizeName, type RawLine } from '../src/assemble';

const times = { lab: ['07:00'], sab: [], fes: [] };

/** Línea de prueba mínima. Cada test cambia solo lo que necesita. */
function rawLine(over: Partial<RawLine> = {}): RawLine {
  return {
    id: '1',
    options: [
      { code: '343', label: 'Plaza Esteve Esteve' },
      { code: '453', label: 'Villamarta Única' },
    ],
    page: { mapId: 'm', directions: [{ headsign: 'San Telmo', stopNames: ['a', 'b'] }] },
    kml: {
      title: 'Línea 1 (ESTEVE - SAN TELMO)',
      stops: [
        { code: '343', name: 'Plaza Esteve', description: 'Esteve', lat: 36.68, lon: -6.13 },
        { code: '453', name: 'Villamarta', description: 'Única', lat: 36.69, lon: -6.14 },
      ],
      shapes: [[[-6.13, 36.68], [-6.14, 36.69]]],
    },
    timesByStop: { '343': times, '453': times },
    ...over,
  };
}

describe('assemble', () => {
  it('coords from kml by code', () => {
    const { stops } = assemble([rawLine()], { stops: {} });
    expect(stops['343']).toEqual({
      code: '343', name: 'Plaza Esteve', description: 'Esteve',
      lat: 36.68, lon: -6.13, coordSource: 'kml',
    });
  });

  it('coords by name match', () => {
    const line = rawLine({
      options: [{ code: '352', label: 'Pz. Madre Dios Subiendo la Plaza' }, { code: '343', label: 'Plaza Esteve Esteve' }],
      kml: {
        title: 'Línea 1 (ESTEVE - SAN TELMO)',
        stops: [
          { code: '280', name: 'Madre de Dios', description: 'a San Telmo', lat: 36.677, lon: -6.13 },
          { code: '343', name: 'Plaza Esteve', description: 'Esteve', lat: 36.68, lon: -6.13 },
        ],
        shapes: [],
      },
    });
    const { stops, warnings } = assemble([line], { stops: {} });
    expect(stops['352']).toMatchObject({ lat: 36.677, lon: -6.13, coordSource: 'name-match' });
    expect(warnings.some((w) => w.includes('352') && w.includes('280'))).toBe(true);
  });

  it('override wins', () => {
    const { stops } = assemble([rawLine()], { stops: { '343': { lat: 36.7, lon: -6.1 } } });
    expect(stops['343']).toMatchObject({ lat: 36.7, lon: -6.1, coordSource: 'override' });
  });

  it('unmatched stop has no coords', () => {
    const line = rawLine({ options: [{ code: '999', label: 'Nada Única' }, { code: '343', label: 'Plaza Esteve Esteve' }] });
    const { stops, warnings } = assemble([line], { stops: {} });
    expect(stops['999']).toBeUndefined();
    expect(warnings).toContain('stop 999 line 1 without coordinates');
  });

  it('directions by position', () => {
    const options = Array.from({ length: 20 }, (_, i) => ({ code: String(i + 1), label: 'P' + i }));
    const page = {
      mapId: 'm',
      directions: [
        { headsign: 'San Telmo', stopNames: Array(15).fill('x') },
        { headsign: 'Plaza Esteve', stopNames: Array(5).fill('y') },
      ],
    };
    const { lines } = assemble([rawLine({ options, page, kml: null })], { stops: {} });
    expect(lines[0].directions[0].stopCodes).toEqual(options.slice(0, 15).map((o) => o.code));
    expect(lines[0].directions[1].stopCodes).toEqual(options.slice(15).map((o) => o.code));
  });

  it('single direction when counts do not add up', () => {
    const page = { mapId: 'm', directions: [{ headsign: 'San Telmo', stopNames: ['a'] }] };
    const { lines, warnings } = assemble([rawLine({ page })], { stops: {} });
    expect(lines[0].directions).toEqual([{ headsign: 'Villamarta Única', stopCodes: ['343', '453'] }]);
    expect(warnings.some((w) => w.includes('line 1') && w.includes('direction'))).toBe(true);
  });

  it('line metadata', () => {
    const { lines } = assemble([rawLine()], { stops: {} });
    expect(lines[0]).toMatchObject({
      id: '1',
      name: 'Esteve - San Telmo',
      colour: '#FFDE4D',
      stopCodes: ['343', '453'],
      shapes: [[[-6.13, 36.68], [-6.14, 36.69]]],
      timesByStop: { '343': times, '453': times },
    });
  });
});

describe('normalizeName', () => {
  it('removes accents, stopwords and abbreviations', () => {
    expect(normalizeName('Madre de Dios')).toBe('madre dios');
    expect(normalizeName('Pz. Madre Dios Subiendo la Plaza')).toBe('madre dios subiendo');
    expect(normalizeName('C/Manuel  Moneo')).toBe('manuel moneo');
    expect(normalizeName('Constitución')).toBe('constitucion');
  });
});
