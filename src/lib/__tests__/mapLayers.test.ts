// Pruebas de mapLayers: convertir paradas y recorridos a GeoJSON y calcular la caja de unos puntos.
import type { Stop } from '@/data/schema';

import { boundsOf, shapesToGeoJSON, stopsToGeoJSON } from '../mapLayers';

const stop = (over: Partial<Stop> = {}): Stop => ({
  code: '1',
  name: 'Plaza',
  description: '',
  lat: 36.68,
  lon: -6.13,
  coordSource: 'kml',
  ...over,
});

describe('stopsToGeoJSON', () => {
  it('usa [lon, lat] y conserva approximate', () => {
    const fc = stopsToGeoJSON([stop({ approximate: true })]);
    expect(fc.features[0].geometry.coordinates).toEqual([-6.13, 36.68]);
    expect(fc.features[0].properties).toMatchObject({ code: '1', name: 'Plaza', approximate: true });
  });

  it('approximate es false si la parada no lo indica', () => {
    expect(stopsToGeoJSON([stop()]).features[0].properties?.approximate).toBe(false);
  });

  it('añade propiedades extra', () => {
    const fc = stopsToGeoJSON([stop()], (s) => ({ label: s.name + '!' }));
    expect(fc.features[0].properties?.label).toBe('Plaza!');
  });
});

describe('shapesToGeoJSON', () => {
  it('da una feature por shape con properties.colour', () => {
    const fc = shapesToGeoJSON(
      [
        [[-6.1, 36.6], [-6.2, 36.7]],
        [[-6.3, 36.8], [-6.0, 36.5]],
      ],
      '#ff0000',
    );
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].properties?.colour).toBe('#ff0000');
    expect(fc.features[1].geometry.type).toBe('LineString');
  });
});

describe('boundsOf', () => {
  it('devuelve [minLon, minLat, maxLon, maxLat]', () => {
    expect(boundsOf([[-6.1, 36.6], [-6.3, 36.9], [-6.2, 36.7]])).toEqual([-6.3, 36.6, -6.1, 36.9]);
  });
  it('devuelve null sin puntos', () => {
    expect(boundsOf([])).toBeNull();
  });
});
