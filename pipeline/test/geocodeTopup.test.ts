// Pruebas de la parte pura de geocodeTopup: elegir (o rechazar) el resultado de Nominatim.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LAT, LON } from '../src/validate';
import { formatTopUpFile, geocodeQuery, pickResult, summarize } from '../src/geocodeTopup';

const bbox = { lat: LAT as [number, number], lon: LON as [number, number] };

describe('pickResult', () => {
  it('rechaza un resultado fuera de Jerez', () => {
    expect(pickResult([{ lat: '40.4', lon: '-3.7', type: 'house' }], bbox)).toBeNull();
  });

  it('sin resultados devuelve null', () => {
    expect(pickResult([], bbox)).toBeNull();
  });

  it('marca una calle como aproximada', () => {
    const r = pickResult([{ lat: '36.68', lon: '-6.13', type: 'residential', category: 'highway' }], bbox);
    expect(r).toEqual({ lat: 36.68, lon: -6.13, approximate: true });
  });

  it('marca una casa, un edificio o un comercio como exactos', () => {
    for (const type of ['house', 'building', 'shop']) {
      expect(pickResult([{ lat: '36.68', lon: '-6.13', type }], bbox)?.approximate).toBe(false);
    }
  });

  it('un comercio de Nominatim (categoría shop) es exacto', () => {
    expect(pickResult([{ lat: '36.68', lon: '-6.13', type: 'kiosk', category: 'shop' }], bbox)?.approximate).toBe(false);
  });

  it('ignora coordenadas que no son números', () => {
    expect(pickResult([{ lat: 'x', lon: '-6.13', type: 'house' }], bbox)).toBeNull();
  });
});

describe('geocodeQuery y summarize', () => {
  it('añade la ciudad a la dirección', () => {
    expect(geocodeQuery('C/ Latorre, 3 (dependencias de Jereyssa)')).toBe('C/ Latorre, 3 (dependencias de Jereyssa), Jerez de la Frontera, España');
  });

  it('cuenta exactos, aproximados y sin resultado', () => {
    const points = [
      { lat: 36.6, lon: -6.1, approximate: false },
      { lat: 36.6, lon: -6.1, approximate: true },
      {},
    ];
    expect(summarize(points)).toEqual({ exact: 1, approximate: 1, none: 1 });
  });
});

describe('formatTopUpFile', () => {
  it('escribe un punto por línea y es JSON válido', () => {
    const file = { source: 's', posterImage: 'p', checked: '2026-10-29', points: [{ name: 'A', address: 'B', zone: 'centro' as const, lat: 36.6, lon: -6.1 }] };
    const text = formatTopUpFile(file);
    expect(text).toContain('    { "name": "A", "address": "B", "zone": "centro", "lat": 36.6, "lon": -6.1 }\n');
    expect(JSON.parse(text)).toEqual(file);
  });
});

describe('formatTopUpFile con el archivo real', () => {
  it('reproduce topup-points.json byte a byte', () => {
    const text = readFileSync(new URL('../topup-points.json', import.meta.url), 'utf8');
    expect(formatTopUpFile(JSON.parse(text))).toBe(text);
  });

  it('no toca el texto de los valores (comillas, ":" o ",\"" dentro de un nombre)', () => {
    const file = { source: 's', posterImage: 'p', checked: '2026-10-29', points: [{ name: 'A":x,"y', address: 'B', zone: 'centro' as const }] };
    expect(JSON.parse(formatTopUpFile(file))).toEqual(file);
  });
});
