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

describe('parseKml code label variants', () => {
  const placemark = (label: string) => `<?xml version="1.0" encoding="UTF-8"?>
<kml><Document><name>Línea 5 (X - Y)</name><Placemark><name>Angustias Canal Sur</name>
<description><![CDATA[TRANSBORDO: 1-2<br>LINEA: 5<br>${label} 130<br>SENTIDO: Única<br>LATITUD: 36.680865<br>LONGITUD: -6.134338]]></description>
<Point><coordinates>-6.134338,36.680865,0</coordinates></Point></Placemark></Document></kml>`;

  it.each(['COD. PARADA:', 'COD.PARADA:', 'COD:'])('reads the code written as "%s"', (label) => {
    expect(parseKml(placemark(label)).stops).toEqual([
      { code: '130', name: 'Angustias Canal Sur', description: 'Única', lat: 36.680865, lon: -6.134338 },
    ]);
  });

  it('reads the line 13 format (Codigo de parada / Direccion)', () => {
    const xml = `<kml><Document><name>L13</name><Placemark><name>Alcázar</name>
<description><![CDATA[descripción: Linea: 13<br>Codigo de parada: 442<br>Direccion: Sentido Campo Juventud<br>Transbordo: <br>Latitud: 36.676901<br>Longitud: -6.143748]]></description>
<Point><coordinates>-6.143748,36.676901,0</coordinates></Point></Placemark></Document></kml>`;
    expect(parseKml(xml).stops).toEqual([
      { code: '442', name: 'Alcázar', description: 'Sentido Campo Juventud', lat: 36.676901, lon: -6.143748 },
    ]);
  });

  it('keeps stops without code (line 10) so they can be matched by name', () => {
    const xml = `<kml><Document><name>L10</name><Placemark><name>Hospital</name>
<description>Sentido Jerez</description>
<Point><coordinates>-6.11,36.69,0</coordinates></Point></Placemark></Document></kml>`;
    expect(parseKml(xml).stops).toEqual([
      { code: '', name: 'Hospital', description: 'Sentido Jerez', lat: 36.69, lon: -6.11 },
    ]);
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
