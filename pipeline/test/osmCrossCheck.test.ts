// Pruebas del cruce de paradas con OpenStreetMap: solo debe avisar, nunca fallar.
import { describe, expect, it } from 'vitest';
import type { Stop } from '../../src/data/schema';
import { osmCrossCheck } from '../src/osmCrossCheck';

const BASE = { lat: 36.68, lon: -6.13 };
// 1 grado de latitud son unos 111.195 m, así que estos desplazamientos dan ~50 m y ~300 m.
const M50 = 50 / 111195;
const M300 = 300 / 111195;

const stop = (code: string, dLat: number, coordSource: Stop['coordSource']): Stop => ({
  code,
  name: `Parada ${code}`,
  description: '',
  lat: BASE.lat + dLat,
  lon: BASE.lon,
  coordSource,
});
const osm = (ref: string) => ({ ref, name: `OSM ${ref}`, lat: BASE.lat, lon: BASE.lon });

describe('osmCrossCheck', () => {
  it('warns only for the stop farther than the threshold', () => {
    const stops = { '1': stop('1', M50, 'kml'), '2': stop('2', M300, 'name-match') };
    const warnings = osmCrossCheck(stops, [osm('1'), osm('2')]);
    expect(warnings).toEqual(['stop 2: official location is 300 m from OSM ref 2']);
  });

  it('gives no warning when OSM has no matching ref', () => {
    const stops = { '1': stop('1', M300, 'kml') };
    expect(osmCrossCheck(stops, [osm('99')])).toEqual([]);
  });

  it('ignores stops with override or osm coordinates', () => {
    const stops = { '1': stop('1', M300, 'override'), '2': stop('2', M300, 'osm') };
    expect(osmCrossCheck(stops, [osm('1'), osm('2')])).toEqual([]);
  });

  it('gives no warnings when OSM data is empty', () => {
    expect(osmCrossCheck({ '1': stop('1', M300, 'kml') }, [])).toEqual([]);
  });
});
