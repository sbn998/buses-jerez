// Pruebas del lector de paradas de OpenStreetMap (respuesta de Overpass).
import { describe, expect, it } from 'vitest';
import { parseOverpass } from '../src/osm';

describe('parseOverpass', () => {
  it('ignores local_ref and refs shared by several nodes', () => {
    const json = JSON.stringify({
      elements: [
        { type: 'node', lat: 36.69, lon: -6.1, tags: { highway: 'bus_stop', local_ref: '12', name: 'X' } },
        { type: 'node', lat: 36.70, lon: -6.1, tags: { highway: 'bus_stop', ref: '40', name: 'A' } },
        { type: 'node', lat: 36.71, lon: -6.1, tags: { highway: 'bus_stop', ref: '40', name: 'B' } },
        { type: 'node', lat: 36.72, lon: -6.1, tags: { highway: 'bus_stop', ref: '41', name: 'C' } },
      ],
    });
    expect(parseOverpass(json)).toEqual([{ ref: '41', name: 'C', lat: 36.72, lon: -6.1 }]);
  });

  it('keeps bus stops with a ref', () => {
    const json = JSON.stringify({
      elements: [
        { type: 'node', lat: 36.698, lon: -6.105, tags: { highway: 'bus_stop', ref: '507', name: 'Calle Huelva' } },
        { type: 'node', lat: 36.69, lon: -6.1, tags: { highway: 'bus_stop', local_ref: '12', name: 'X' } },
        { type: 'node', lat: 36.6, lon: -6.2, tags: { highway: 'bus_stop', name: 'Sin código' } },
      ],
    });
    expect(parseOverpass(json)).toEqual([
      { ref: '507', name: 'Calle Huelva', lat: 36.698, lon: -6.105 },
    ]);
  });
});
