// Pruebas del lector del mapa oficial (KML) de una línea, con el mapa real de la línea 1.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseKml, parseLineName } from '../src/comujesa/parseKml';

const xml = readFileSync(new URL('./fixtures/kml-1.kml', import.meta.url), 'utf8');

describe('parseKml', () => {
  it('reads title, stops with code and coordinates, and the route', () => {
    const kml = parseKml(xml);
    expect(kml.title).toBe('Línea 1 (ESTEVE - SAN TELMO)');
    expect(kml.stops.length).toBeGreaterThanOrEqual(20);
    expect(kml.stops.find((s) => s.code === '343')).toEqual({
      code: '343',
      name: 'Plaza Esteve',
      description: 'Esteve',
      lat: 36.681745,
      lon: -6.136679,
    });
    expect(kml.stops.find((s) => s.code === '453')?.description).toBe('Única');
    expect(kml.shapes).toHaveLength(1);
    expect(kml.shapes[0].length).toBeGreaterThan(10);
  });
});

describe('parseLineName', () => {
  it('turns the map title into readable line ends', () => {
    expect(parseLineName('Línea 1 (ESTEVE - SAN TELMO)')).toBe('Esteve - San Telmo');
    expect(parseLineName('LINEA 15 (NUEVA JARILLA - GUADALCACÍN - ANGUSTIAS - EL PORTAL)')).toBe(
      'Nueva Jarilla - Guadalcacín - Angustias - El Portal',
    );
  });
});
