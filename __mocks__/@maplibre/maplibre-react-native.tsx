// Simulación (mock) de MapLibre para Jest: el módulo nativo real no existe en las pruebas.
// Pinta Views con testID, apunta lo que recibe cada componente (para que las pruebas lo comprueben)
// y deja provocar el fallo de carga, el fin de carga, un error al pintar o la pulsación de una parada.
// Las props llevan los tipos reales de la librería, así un error de configuración rompe el typecheck.
import type {
  CameraProps,
  CameraRef,
  GeoJSONSourceProps,
  LayerProps,
  MapProps,
} from '@maplibre/maplibre-react-native';
import { useImperativeHandle } from 'react';
import { Pressable, View } from 'react-native';

// Lo recibido se guarda en globalThis: Jest puede cargar este archivo dos veces
// (una desde la prueba y otra desde el componente) y así ambas copias comparten el dato.
type Recorded = {
  map?: MapProps;
  camera?: CameraProps;
  /** Movimientos pedidos a la cámara con su ref (flyTo, fitBounds…), en orden. */
  cameraCalls: { method: 'jumpTo' | 'easeTo' | 'flyTo' | 'fitBounds'; args: unknown[] }[];
  layers: Record<string, LayerProps>;
  sources: Record<string, GeoJSONSourceProps>;
  /** true si Map debe lanzar un error al pintarse (simula una vista nativa rota). */
  broken?: boolean;
};
const store = globalThis as unknown as { __maplibreMock?: Recorded };
function recorded(): Recorded {
  store.__maplibreMock ??= { layers: {}, sources: {}, cameraCalls: [] };
  return store.__maplibreMock;
}

// Borra lo apuntado (lo llaman las pruebas antes de pintar).
export function resetMock() {
  store.__maplibreMock = { layers: {}, sources: {}, cameraCalls: [] };
}

// Devuelve lo que recibieron Map, Camera y cada Layer en el último pintado.
export function getRecorded(): Recorded {
  return recorded();
}

// Una prueba llama a failMapLoading() para simular que el mapa no ha podido cargarse.
export function failMapLoading() {
  recorded().map?.onDidFailLoadingMap?.({ nativeEvent: null } as never);
}

// Una prueba llama a finishStyleLoading() / finishMapLoading() para simular que el mapa ha terminado de cargar.
export function finishStyleLoading() {
  recorded().map?.onDidFinishLoadingStyle?.({ nativeEvent: null } as never);
}
export function finishMapLoading() {
  recorded().map?.onDidFinishLoadingMap?.({ nativeEvent: null } as never);
}

// Una prueba llama a breakMapRendering() para que Map lance un error al pintarse.
export function breakMapRendering() {
  recorded().broken = true;
}

export function Map(props: MapProps) {
  if (recorded().broken) throw new Error('fallo al pintar (simulado)');
  recorded().map = props;
  return <View testID="map-view">{props.children}</View>;
}

// La cámara acepta una ref y apunta cada movimiento que se le pide.
export function Camera(props: CameraProps) {
  const { ref, ...rest } = props;
  recorded().camera = rest;
  const record = (method: Recorded['cameraCalls'][number]['method']) => (...args: unknown[]) => {
    recorded().cameraCalls.push({ method, args });
  };
  useImperativeHandle(
    ref,
    () =>
      ({
        jumpTo: record('jumpTo'),
        easeTo: record('easeTo'),
        flyTo: record('flyTo'),
        fitBounds: record('fitBounds'),
      }) as unknown as CameraRef,
  );
  return <View testID="map-camera" />;
}

// Para probar la pulsación: un Pressable (`press-<id>`) que entrega la primera feature de los datos,
// y uno por feature con código (`press-<id>-<código>`) para tocar una parada concreta.
export function GeoJSONSource(props: GeoJSONSourceProps) {
  const { id, children, onPress, data } = props;
  if (id) recorded().sources[id] = props;
  const features = typeof data === 'object' && data.type === 'FeatureCollection' ? data.features : [];
  const first = features[0];
  return (
    <View testID={`shape-source-${id}`}>
      {onPress && first ? (
        <Pressable
          testID={`press-${id}`}
          onPress={() => onPress({ nativeEvent: { features: [first] } } as never)}
        />
      ) : null}
      {onPress
        ? features.map((f) => (
            <Pressable
              key={String(f.properties?.code)}
              testID={`press-${id}-${f.properties?.code}`}
              onPress={() => onPress({ nativeEvent: { features: [f] } } as never)}
            />
          ))
        : null}
      {children}
    </View>
  );
}

export function Layer(props: LayerProps) {
  if (props.id) recorded().layers[props.id] = props;
  return <View testID={`layer-${props.id}`} />;
}
