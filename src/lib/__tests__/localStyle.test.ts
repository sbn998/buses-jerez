// Pruebas de buildLocalStyle: cambia las dos direcciones y no toca el estilo original.
import { buildLocalStyle } from '../localStyle';

const remote = {
  version: 8,
  sources: { openmaptiles: { type: 'vector', url: 'pmtiles://https://x/map/jerez.pmtiles' } },
  glyphs: 'https://x/map/fonts/{fontstack}/{range}.pbf',
  layers: [{ id: 'bg' }],
};

describe('buildLocalStyle', () => {
  it('cambia las URLs de las teselas y de las tipografías', () => {
    const local = buildLocalStyle(remote, 'file:///doc/map') as typeof remote;
    expect(local.sources.openmaptiles.url).toBe('pmtiles://file:///doc/map/jerez.pmtiles');
    expect(local.glyphs).toBe('file:///doc/map/fonts/{fontstack}/{range}.pbf');
    expect(local.layers).toEqual([{ id: 'bg' }]);
  });

  it('no modifica el estilo de entrada', () => {
    const copy = JSON.parse(JSON.stringify(remote));
    buildLocalStyle(remote, 'file:///doc/map');
    expect(remote).toEqual(copy);
  });

  it('lanza un error si el estilo no tiene la fuente openmaptiles', () => {
    expect(() => buildLocalStyle({ version: 8, sources: {} }, 'file:///doc/map')).toThrow();
  });
});
