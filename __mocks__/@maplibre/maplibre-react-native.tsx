// Simulación (mock) de MapLibre para Jest: el módulo nativo real no existe en las pruebas.
// Pinta Views con testID y deja que una prueba provoque el fallo de carga o la pulsación de una parada.
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

type MapProps = { children?: ReactNode; onDidFailLoadingMap?: () => void };

// Una prueba llama a failMapLoading() para simular que el mapa no ha podido cargarse.
// Se guarda el último mapa pintado en globalThis: así lo comparten la prueba y el componente
// aunque Jest cargara este archivo dos veces.
const store = globalThis as unknown as { __lastMapProps?: MapProps };
export function failMapLoading() {
  store.__lastMapProps?.onDidFailLoadingMap?.();
}

export function Map(props: MapProps) {
  store.__lastMapProps = props;
  return <View testID="map-view">{props.children}</View>;
}

export function Camera() {
  return <View testID="map-camera" />;
}

type SourceProps = {
  id?: string;
  data?: unknown;
  children?: ReactNode;
  onPress?: (e: { nativeEvent: { features: unknown[] } }) => void;
};

// Para probar la pulsación: un Pressable que entrega una feature con el código indicado.
export function GeoJSONSource({ id, children, onPress, data }: SourceProps) {
  const first = (data as { features?: { properties?: { code?: string } }[] })?.features?.[0];
  return (
    <View testID={`shape-source-${id}`}>
      {onPress && first ? (
        <Pressable
          testID={`press-${id}`}
          onPress={() => onPress({ nativeEvent: { features: [first] } })}
        />
      ) : null}
      {children}
    </View>
  );
}

export function Layer({ id }: { id?: string }) {
  return <View testID={`layer-${id}`} />;
}
