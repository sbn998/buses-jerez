// Mapa de Jerez con MapLibre (paradas, recorridos y posición del usuario).
// Si el módulo nativo no existe (Jest, Expo Go) o el mapa falla, muestra MapPlaceholder: nunca bloquea la pantalla.
import { Component, type ReactNode, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Stop } from '@/data/schema';
import { JEREZ_BOUNDS, MAP_STYLE_URL, shapesToGeoJSON, stopsToGeoJSON } from '@/lib/mapLayers';

import { MapPlaceholder } from './MapPlaceholder';

type MapLibre = typeof import('@maplibre/maplibre-react-native');

// Carga MapLibre solo cuando hace falta. Si el módulo nativo no está, `require` falla y devolvemos null.
function loadMapLibre(): MapLibre | null {
  try {
    return require('@maplibre/maplibre-react-native') as MapLibre;
  } catch (error) {
    // Solo en desarrollo: deja el motivo en la consola para no esconder fallos reales.
    if (__DEV__) console.warn('JerezMap: no se pudo cargar MapLibre', error);
    return null;
  }
}

// Un error al pintar el mapa (por ejemplo, vista nativa ausente) se convierte en el recuadro de reserva.
class MapErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  // Solo en desarrollo, deja el error en la consola para poder investigarlo.
  componentDidCatch(error: Error) {
    if (__DEV__) console.warn('JerezMap: error al pintar el mapa', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export type JerezMapProps = {
  height: number;
  /** [lon, lat] */
  center?: [number, number];
  zoom?: number;
  /** [lonMin, latMin, lonMax, latMax]; si se indica, manda sobre center y zoom. */
  bounds?: [number, number, number, number];
  stops?: Stop[];
  shapes?: { shapes: [number, number][][]; colour: string };
  user?: { lat: number; lon: number } | null;
  onStopPress?: (code: string) => void;
};

const EMPTY_STOPS: Stop[] = [];

export function JerezMap(props: JerezMapProps) {
  const [failed, setFailed] = useState(false);
  const maplibre = useMemo(loadMapLibre, []);
  const fallback = <MapPlaceholder height={props.height} />;
  if (!maplibre || failed) return fallback;
  return (
    <MapErrorBoundary fallback={fallback}>
      <MapContent {...props} maplibre={maplibre} onFail={() => setFailed(true)} />
    </MapErrorBoundary>
  );
}

function MapContent({
  maplibre,
  onFail,
  height,
  center,
  zoom,
  bounds,
  stops = EMPTY_STOPS,
  shapes,
  user,
  onStopPress,
}: JerezMapProps & { maplibre: MapLibre; onFail: () => void }) {
  const { Map, Camera, GeoJSONSource, Layer } = maplibre;

  const stopsData = useMemo(() => stopsToGeoJSON(stops), [stops]);
  const shapesData = useMemo(
    () => (shapes ? shapesToGeoJSON(shapes.shapes, shapes.colour) : null),
    [shapes],
  );
  // La posición del usuario es un punto GeoJSON más.
  const userData = useMemo<GeoJSON.Point | null>(
    () => (user ? { type: 'Point', coordinates: [user.lon, user.lat] } : null),
    [user],
  );

  // Vista inicial: la caja dada, o centro y zoom, o toda la zona de Jerez.
  const initialViewState = bounds
    ? { bounds, padding: { top: 24, right: 24, bottom: 24, left: 24 } }
    : center
      ? { center, zoom: zoom ?? 14 }
      : { bounds: JEREZ_BOUNDS };

  return (
    <View style={{ height }}>
      <Map
        style={styles.fill}
        mapStyle={MAP_STYLE_URL}
        attribution={false}
        logo={false}
        onDidFailLoadingMap={onFail}
      >
        <Camera initialViewState={initialViewState} minZoom={10} maxBounds={JEREZ_BOUNDS} />
        {shapesData ? (
          <GeoJSONSource id="shapes" data={shapesData}>
            <Layer
              type="line"
              id="shapes-line"
              paint={{ 'line-color': ['get', 'colour'], 'line-width': 4 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        ) : null}
        <GeoJSONSource
          id="stops"
          data={stopsData}
          onPress={(e) => {
            const code = e.nativeEvent.features[0]?.properties?.code;
            if (typeof code === 'string') onStopPress?.(code);
          }}
        >
          <Layer
            type="circle"
            id="stops-circle"
            paint={{
              'circle-radius': 6,
              // Paradas aproximadas: círculo hueco; el resto, relleno blanco.
              'circle-color': ['case', ['get', 'approximate'], 'rgba(255,255,255,0)', '#ffffff'],
              'circle-stroke-color': '#1f2937',
              'circle-stroke-width': 2,
            }}
          />
        </GeoJSONSource>
        {userData ? (
          <GeoJSONSource id="user" data={userData}>
            <Layer
              type="circle"
              id="user-circle"
              paint={{
                'circle-radius': 8,
                'circle-color': '#2563eb',
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 3,
              }}
            />
          </GeoJSONSource>
        ) : null}
      </Map>
      {/* Atribución obligatoria por la licencia de OpenStreetMap (ODbL). */}
      <Text style={styles.attribution}>© OpenStreetMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  attribution: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 11,
    color: '#1f2937',
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
});
