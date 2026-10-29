// Estilo del mapa de Jerez (MapLibre, versión 8) para teselas vectoriales OpenMapTiles.
// Es una función pura: recibe la URL base donde se publica el mapa y devuelve el JSON del estilo.
// Colores claros y neutros para que las líneas de bus (de color) destaquen encima.

/** Tipo mínimo de capa; basta para lo que usamos, sin depender de la librería de estilos. */
export interface StyleLayer {
  id: string;
  type: 'background' | 'fill' | 'line' | 'symbol';
  source?: string;
  'source-layer'?: string;
  minzoom?: number;
  filter?: unknown[];
  layout?: Record<string, unknown>;
  paint: Record<string, unknown>;
}

export interface MapStyle {
  version: 8;
  name: string;
  sources: Record<string, { type: 'vector'; url: string; attribution: string }>;
  glyphs: string;
  layers: StyleLayer[];
}

const SOURCE = 'openmaptiles';
const FONT_REGULAR = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];

/** Anchura de línea que crece con el zoom: [zoom, píxeles] para z10, z14 y z16. */
function width(z10: number, z14: number, z16: number): unknown {
  return ['interpolate', ['exponential', 1.4], ['zoom'], 10, z10, 14, z14, 16, z16];
}

/** Una capa de carretera: filtra por `class` de OpenMapTiles y pinta una línea. */
function road(id: string, classes: string[], color: string, w: unknown, minzoom = 10): StyleLayer {
  return {
    id,
    type: 'line',
    source: SOURCE,
    'source-layer': 'transportation',
    minzoom,
    filter: ['in', ['get', 'class'], ['literal', classes]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': w },
  };
}

export function buildStyle(baseUrl: string): MapStyle {
  return {
    version: 8,
    name: 'Jerez',
    sources: {
      [SOURCE]: {
        type: 'vector',
        url: `pmtiles://${baseUrl}/map/jerez.pmtiles`,
        attribution: '© OpenStreetMap',
      },
    },
    glyphs: `${baseUrl}/map/fonts/{fontstack}/{range}.pbf`,
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f4f1ea' } },
      {
        id: 'landuse',
        type: 'fill',
        source: SOURCE,
        'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood', 'commercial', 'industrial']]],
        paint: { 'fill-color': '#ece8df' },
      },
      {
        id: 'park',
        type: 'fill',
        source: SOURCE,
        'source-layer': 'park',
        paint: { 'fill-color': '#d9e8cf' },
      },
      {
        id: 'water',
        type: 'fill',
        source: SOURCE,
        'source-layer': 'water',
        paint: { 'fill-color': '#bcd6ea' },
      },
      {
        id: 'building',
        type: 'fill',
        source: SOURCE,
        'source-layer': 'building',
        minzoom: 15,
        paint: { 'fill-color': '#e2ded4', 'fill-outline-color': '#d3cec2' },
      },
      // Carreteras de menor a mayor importancia, para que las grandes queden encima.
      road('road-service', ['service', 'track'], '#ffffff', width(0.3, 0.8, 2)),
      road('road-minor', ['tertiary', 'minor'], '#ffffff', width(0.5, 1.5, 4), 11),
      road('road-primary', ['primary', 'secondary'], '#fbe9c2', width(1, 2.5, 7)),
      road('road-motorway', ['motorway', 'trunk'], '#f7d58a', width(1.5, 3.5, 9)),
      {
        id: 'rail',
        type: 'line',
        source: SOURCE,
        'source-layer': 'transportation',
        minzoom: 11,
        filter: ['==', ['get', 'class'], 'rail'],
        paint: { 'line-color': '#b9b5ad', 'line-width': width(0.6, 1, 1.5), 'line-dasharray': [3, 3] },
      },
      {
        id: 'road-names',
        type: 'symbol',
        source: SOURCE,
        'source-layer': 'transportation_name',
        minzoom: 14,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': FONT_REGULAR,
          'text-size': 11,
        },
        paint: { 'text-color': '#555555', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
      },
      {
        id: 'place-names',
        type: 'symbol',
        source: SOURCE,
        'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'suburb', 'neighbourhood', 'hamlet']]],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': FONT_BOLD,
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 12, 16, 16],
        },
        paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
      },
    ],
  };
}
