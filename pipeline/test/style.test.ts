// Pruebas del estilo del mapa: fuentes, glifos, capas y tipografías permitidas.
import { describe, expect, it } from 'vitest';
import { buildStyle } from '../src/map/style';

const style = buildStyle('https://x') as any;
const layers: any[] = style.layers;

describe('buildStyle', () => {
  it('is a MapLibre style v8', () => {
    expect(style.version).toBe(8);
  });

  it('points the vector source at the pmtiles file', () => {
    expect(style.sources.openmaptiles.type).toBe('vector');
    expect(style.sources.openmaptiles.url).toBe('pmtiles://https://x/map/jerez.pmtiles');
    expect(style.sources.openmaptiles.attribution).toBe('© OpenStreetMap');
  });

  it('serves glyphs from the map fonts folder', () => {
    expect(style.glyphs).toBe('https://x/map/fonts/{fontstack}/{range}.pbf');
  });

  it('has no sprite', () => {
    expect('sprite' in style).toBe(false);
  });

  it('only uses OpenMapTiles source layers', () => {
    const allowed = ['water', 'landuse', 'landcover', 'park', 'building', 'transportation', 'transportation_name', 'place'];
    for (const l of layers.filter((x) => x.type !== 'background')) {
      expect(l.source).toBe('openmaptiles');
      expect(allowed).toContain(l['source-layer']);
    }
  });

  it('starts with the background and has unique layer ids', () => {
    expect(layers[0].type).toBe('background');
    const ids = layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('symbol layers only use the two available fonts', () => {
    const symbols = layers.filter((l) => l.type === 'symbol');
    expect(symbols.length).toBeGreaterThan(0);
    for (const l of symbols) {
      for (const f of l.layout['text-font']) {
        expect(['Noto Sans Regular', 'Noto Sans Bold']).toContain(f);
      }
    }
  });
});
