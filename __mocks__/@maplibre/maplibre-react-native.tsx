// Simulación (mock) de MapLibre para Jest: el módulo nativo real no existe en las pruebas.
// Pinta Views con testID, apunta lo que recibe cada componente (para que las pruebas lo comprueben)
// y deja provocar el fallo de carga o la pulsación de una parada.
// Las props llevan los tipos reales de la librería, así un error de configuración rompe el typecheck.
import type {
  CameraProps,
  GeoJSONSourceProps,
  LayerProps,
  MapProps,
} from '@maplibre/maplibre-react-native';
import { Pressable, View } from 'react-native';

// Lo recibido se guarda en globalThis: Jest puede cargar este archivo dos veces
// (una desde la prueba y otra desde el componente) y así ambas copias comparten el dato.
type Recorded = {
  map?: MapProps;
  camera?: CameraProps;
  layers: Record<string, LayerProps>;
};
const store = globalThis as unknown as { __maplibreMock?: Recorded };
function recorded(): Recorded {
  store.__maplibreMock ??= { layers: {} };
  return store.__maplibreMock;
}

// Borra lo apuntado (lo llaman las pruebas antes de pintar).
export function resetMock() {
  store.__maplibreMock = { layers: {} };
}

// Devuelve lo que recibieron Map, Camera y cada Layer en el último pintado.
export function getRecorded(): Recorded {
  return recorded();
}

// Una prueba llama a failMapLoading() para simular que el mapa no ha podido cargarse.
export function failMapLoading() {
  recorded().map?.onDidFailLoadingMap?.({ nativeEvent: null } as never);
}

export function Map(props: MapProps) {
  recorded().map = props;
  return <View testID="map-view">{props.children}</View>;
}

export function Camera(props: CameraProps) {
  recorded().camera = props;
  return <View testID="map-camera" />;
}

// Para probar la pulsación: un Pressable que entrega la primera feature de los datos.
export function GeoJSONSource({ id, children, onPress, data }: GeoJSONSourceProps) {
  const first =
    typeof data === 'object' && data.type === 'FeatureCollection' ? data.features[0] : undefined;
  return (
    <View testID={`shape-source-${id}`}>
      {onPress && first ? (
        <Pressable
          testID={`press-${id}`}
          onPress={() => onPress({ nativeEvent: { features: [first] } } as never)}
        />
      ) : null}
      {children}
    </View>
  );
}

export function Layer(props: LayerProps) {
  if (props.id) recorded().layers[props.id] = props;
  return <View testID={`layer-${props.id}`} />;
}
