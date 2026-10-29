// Pestaña "Cerca de mí": favoritos con su próximo bus, y las paradas a menos de 500 m de donde
// estás (la más cercana abierta), con un mapa donde tocar una parada abre su tarjeta.
import { useRouter } from 'expo-router';
import { type ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JerezMap, type MapStatus } from '@/components/map/JerezMap';
import { LocationState } from '@/components/nearby/LocationState';
import { NearbyStopCard } from '@/components/nearby/NearbyStopCard';
import { FavoritesList } from '@/components/schedule/FavoritesList';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useLocation } from '@/hooks/use-location';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { nearbyStops } from '@/lib/nearby';
import { boundsOf } from '@/lib/mapLayers';
import { openSchedule } from '@/lib/navigation';
import { useFavorites } from '@/stores/favorites';

const MAP_HEIGHT = 240;

export default function Cerca() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { data } = useData();
  const now = useNow();
  const favorites = useFavorites((s) => s.items);
  const { status, coords, accuracy, coarse, retry } = useLocation();
  // Posición poco fiable: margen de error de más de 100 m, o permiso de ubicación aproximada.
  const approximate = coarse || (accuracy ?? 0) > 100;
  // Paradas que el usuario ha abierto o cerrado a mano (la más cercana empieza abierta).
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const nearby = useMemo(() => (coords ? nearbyStops(data, coords) : null), [data, coords]);
  const mapStops = useMemo(() => nearby?.items.map((i) => i.stop), [nearby]);
  const hasApproximate = mapStops?.some((s) => s.approximate) ?? false;
  // Estado del mapa: si solo hay recuadro de texto ('unavailable') no se dibuja ningún círculo, así que sobra la leyenda.
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');

  // Vista del mapa: una caja que abarca al usuario y las paradas mostradas.
  // Si todo cae en el mismo punto (la caja no tendría tamaño), centramos en el usuario con zoom 15.
  const mapView = useMemo(() => {
    if (!coords) return null;
    const points: [number, number][] = [
      ...(mapStops ?? []).map((s): [number, number] => [s.lon, s.lat]),
      [coords.lon, coords.lat],
    ];
    const box = points.length >= 2 ? boundsOf(points) : null;
    if (box && (box[0] !== box[2] || box[1] !== box[3])) return { bounds: box };
    return { center: [coords.lon, coords.lat] as [number, number], zoom: 15 };
  }, [coords, mapStops]);

  // Para llevar la lista hasta una parada tocada en el mapa: guardamos dónde está cada tarjeta.
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const cardY = useRef<Record<string, number>>({});
  const [focus, setFocus] = useState<{ code: string; n: number } | null>(null);

  // Tocar una parada en el mapa: abre su tarjeta y pide desplazarse hasta ella.
  const openFromMap = useCallback((code: string) => {
    setToggled((prev) => ({ ...prev, [code]: true }));
    setFocus((prev) => ({ code, n: (prev?.n ?? 0) + 1 }));
  }, []);

  // Cuando hay una parada pendiente, desplazamos la lista hasta su tarjeta.
  useEffect(() => {
    if (!focus) return;
    const y = cardY.current[focus.code];
    if (y != null) scrollRef.current?.scrollTo({ y, animated: true });
  }, [focus]);

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <ThemedText type="subtitle">{t('schedule.favorites')}</ThemedText>
        <FavoritesList items={favorites} now={now} onSelect={(f) => openSchedule(router, f.lineId, f.stopCode)} />

        {coords && mapStops ? (
          <View style={styles.mapBox}>
            <JerezMap
              height={MAP_HEIGHT}
              {...mapView}
              stops={mapStops}
              user={coords}
              onStopPress={openFromMap}
              onStatusChange={setMapStatus}
            />
            {hasApproximate && mapStatus !== 'unavailable' ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('nearby.approxLegend')}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {status === 'ready' ? (
          nearby ? (
            <>
              <ThemedText type="subtitle">{t(nearby.withinRadius ? 'nearby.stopsWithin' : 'nearby.closest')}</ThemedText>
              {approximate ? (
                <ThemedText themeColor="textSecondary">
                  {accuracy != null && accuracy > 100
                    ? t('nearby.approxLocation', { meters: Math.round(accuracy) })
                    : t('nearby.approxLocationNoMeters')}
                </ThemedText>
              ) : null}
              {nearby.withinRadius ? null : (
                <ThemedText themeColor="textSecondary">{t('nearby.farWarning')}</ThemedText>
              )}
              {nearby.items.map((item, index) => (
                <View
                  key={item.stop.code}
                  onLayout={(e) => {
                    cardY.current[item.stop.code] = e.nativeEvent.layout.y;
                  }}
                >
                  <NearbyStopCard
                    item={item}
                    showMinutes={!approximate}
                    now={now}
                    open={toggled[item.stop.code] ?? index === 0}
                    onToggle={() =>
                      setToggled((prev) => ({ ...prev, [item.stop.code]: !(prev[item.stop.code] ?? index === 0) }))
                    }
                    onSelectLine={(lineId, stopCode) => openSchedule(router, lineId, stopCode)}
                  />
                </View>
              ))}
            </>
          ) : null
        ) : (
          <LocationState status={status} onRetry={retry} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three, paddingBottom: BottomTabInset + Spacing.four, gap: Spacing.three },
  mapBox: { gap: Spacing.one, borderRadius: Spacing.three, overflow: 'hidden' },
});

// Si esta pantalla falla, se muestra su propio aviso y la barra de pestañas sigue visible.
export { RouteError as ErrorBoundary } from '@/components/RouteError';
