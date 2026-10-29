// Mapa de Jerez con MapLibre (paradas, recorridos y posición del usuario).
// Si el módulo nativo no existe (Jest, Expo Go) muestra MapPlaceholder: ahí no hay motor de mapas que dibuje nada.
// Si el mapa no consigue cargar (sin conexión, o sin respuesta en 8 s), sigue dibujando las paradas y al usuario
// sobre un fondo liso, con un aviso y un botón "Reintentar". El mapa nunca bloquea la pantalla.
import { Component, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Stop } from '@/data/schema';
import { JEREZ_BOUNDS, MAP_STYLE_URL, shapesToGeoJSON, stopsToGeoJSON } from '@/lib/mapLayers';

import { MapPlaceholder } from './MapPlaceholder';

type MapLibre = typeof import('@maplibre/maplibre-react-native');

// Estado del mapa que se avisa a la pantalla:
// loading = cargando, ready = cargado, fallback = fondo liso con paradas, unavailable = solo el recuadro de texto.
export type MapStatus = 'loading' | 'ready' | 'fallback' | 'unavailable';
type DrawnStatus = Exclude<MapStatus, 'unavailable'>;

// Milisegundos máximos que esperamos a que el mapa avise de que ha cargado.
// MapLibre en Android puede esperar sin fin a que vuelva la conexión sin dar nunca error.
const LOAD_TIMEOUT_MS = 8000;

// Estilo de reserva: solo un fondo gris suave (sin calles). Las paradas y el usuario se dibujan encima.
const FALLBACK_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [{ id: 'bg', type: 'background' as const, paint: { 'background-color': '#e5e7eb' } }],
};

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

// Un error al pintar el mapa (por ejemplo, vista nativa ausente) se convierte en el recuadro de texto.
class MapErrorBoundary extends Component<
  { fallback: ReactNode; onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  // Avisa al padre (para informar del estado) y, solo en desarrollo, deja el error en la consola.
  componentDidCatch(error: Error) {
    if (__DEV__) console.warn('JerezMap: error al pintar el mapa', error);
    this.props.onError();
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
  /** Avisa cuando cambia el estado del mapa (por ejemplo, para ocultar la leyenda si solo hay recuadro). */
  onStatusChange?: (status: MapStatus) => void;
};

const EMPTY_STOPS: Stop[] = [];

export function JerezMap(props: JerezMapProps) {
  const [crashed, setCrashed] = useState(false);
  const [drawnStatus, setDrawnStatus] = useState<DrawnStatus>('loading');
  const maplibre = useMemo(loadMapLibre, []);
  const status: MapStatus = !maplibre || crashed ? 'unavailable' : drawnStatus;

  // Avisamos a la pantalla cada vez que cambia el estado. La función se guarda en una ref
  // para que recibir una nueva en cada pintado no dispare el aviso otra vez.
  const onStatusChange = useRef(props.onStatusChange);
  onStatusChange.current = props.onStatusChange;
  useEffect(() => {
    onStatusChange.current?.(status);
  }, [status]);

  const placeholder = <MapPlaceholder height={props.height} />;
  if (!maplibre || crashed) return placeholder;
  return (
    <MapErrorBoundary fallback={placeholder} onError={() => setCrashed(true)}>
      <MapContent {...props} maplibre={maplibre} onPhaseChange={setDrawnStatus} />
    </MapErrorBoundary>
  );
}

function MapContent({
  maplibre,
  onPhaseChange,
  height,
  center,
  zoom,
  bounds,
  stops = EMPTY_STOPS,
  shapes,
  user,
  onStopPress,
}: Omit<JerezMapProps, 'onStatusChange'> & { maplibre: MapLibre; onPhaseChange: (phase: DrawnStatus) => void }) {
  const { Map, Camera, GeoJSONSource, Layer } = maplibre;
  const { t } = useTranslation();

  // 'loading' = esperando al mapa; 'ready' = cargado; 'fallback' = fondo liso porque no ha cargado.
  const [phase, setPhase] = useState<DrawnStatus>('loading');
  useEffect(() => {
    onPhaseChange(phase);
  }, [phase, onPhaseChange]);

  // Mientras carga, arrancamos un reloj de 8 s: si el mapa no avisa a tiempo, pasamos al fondo liso.
  // Al salir de 'loading' o al desmontar, el reloj se cancela.
  useEffect(() => {
    if (phase !== 'loading') return;
    const timer = setTimeout(() => setPhase('fallback'), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // El mapa avisa de que ha cargado. Si ya estamos en el fondo liso, el aviso es del propio fondo y se ignora.
  const handleLoaded = useCallback(() => setPhase((p) => (p === 'loading' ? 'ready' : p)), []);
  // La carga falla: fondo liso. Si el mapa ya se había cargado (por ejemplo, desde la caché), lo dejamos.
  const handleFailed = useCallback(() => setPhase((p) => (p === 'loading' ? 'fallback' : p)), []);
  const retry = useCallback(() => setPhase('loading'), []);

  // Al volver a la app desde segundo plano con el fondo liso, lo reintentamos.
  useEffect(() => {
    if (phase !== 'fallback') return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setPhase('loading');
    });
    return () => subscription.remove();
  }, [phase]);

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
        mapStyle={phase === 'fallback' ? FALLBACK_STYLE : MAP_STYLE_URL}
        attribution={false}
        logo={false}
        onDidFailLoadingMap={handleFailed}
        onDidFinishLoadingStyle={handleLoaded}
        onDidFinishLoadingMap={handleLoaded}
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
          // Zona de toque ampliada 16 px por cada lado: las paradas son pequeñas y cuesta acertar con el dedo.
          hitbox={{ top: 16, right: 16, bottom: 16, left: 16 }}
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
      {/* Aviso sobre el fondo liso, con botón para volver a intentar cargar el mapa. */}
      {phase === 'fallback' ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{t('map.unavailable')}</Text>
          <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}>
            <Text style={styles.retryText}>{t('map.retry')}</Text>
          </Pressable>
        </View>
      ) : null}
      {/* Atribución obligatoria por la licencia de OpenStreetMap (ODbL). */}
      <Text style={styles.attribution}>© OpenStreetMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  banner: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  bannerText: { flexShrink: 1, fontSize: 13, color: '#1f2937' },
  retry: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#1f2937' },
  retryText: { fontSize: 13, color: '#ffffff' },
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
