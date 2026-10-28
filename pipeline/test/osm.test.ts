// Pruebas del lector de paradas de OpenStreetMap (respuesta de Overpass).
import { describe, expect, it } from 'vitest';
import { parseOverpass } from '../src/osm';

describe('parseOverpass', () => {
  it('keeps bus stops with a ref and uses local_ref when ref is missing', () => {
    const json = JSON.stringify({
      elements: [
        { type: 'node', lat: 36.698, lon: -6.105, tags: { highway: 'bus_stop', ref: '507', name: 'Calle Huelva' } },
        { type: 'node', lat: 36.69, lon: -6.1, tags: { highway: 'bus_stop', local_ref: '12', name: 'X' } },
        { type: 'node', lat: 36.6, lon: -6.2, tags: { highway: 'bus_stop', name: 'Sin código' } },
      ],
    });
    expect(parseOverpass(json)).toEqual([
      { ref: '507', name: 'Calle Huelva', lat: 36.698, lon: -6.105 },
      { ref: '12', name: 'X', lat: 36.69, lon: -6.1 },
    ]);
  });
});
