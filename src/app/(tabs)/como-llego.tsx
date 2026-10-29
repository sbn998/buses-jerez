// Pestaña "Cómo llego": comprueba la conexión, elige el origen (tu ubicación o un lugar escrito)
// y busca el destino. Con origen y destino calcula las opciones de bus de hoy, las ordena
// según lo que elijas y dibuja la opción seleccionada en el mapa.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfflineNotice } from '@/components/directions/OfflineNotice';
import { PlaceSearch } from '@/components/directions/PlaceSearch';
import { RouteOptionCard } from '@/components/directions/RouteOptionCard';
import { SortSelector } from '@/components/directions/SortSelector';
import { JerezMap } from '@/components/map/JerezMap';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type { Stop } from '@/data/schema';
import { useLocation } from '@/hooks/use-location';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { distanceMeters } from '@/lib/geo';
import { boundsOf } from '@/lib/mapLayers';
import { isOnline } from '@/lib/online';
import type { Place } from '@/lib/placeSearch';
import { estimateWalk, legCoords, planTrips, sortOptions, type LatLon, type SortMode } from '@/lib/planner';

type Connection = 'checking' | 'online' | 'offline';
type Origin = { kind: 'me' } | { kind: 'place'; place: Place };

// Estados de ubicación en los que no hay posición y hay que pedir el origen escrito.
const NO_POSITION = ['denied', 'blocked', 'unavailable', 'nosignal'];

// Si el destino está a menos de esto (en línea recta), se sugiere ir andando.
const WALK_INSTEAD_METERS = 400;
// Alto del mapa de resultados.
const MAP_HEIGHT = 220;

export default function ComoLlego() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { status, coords } = useLocation();
  const { data } = useData();
  const now = useNow();
  const [connection, setConnection] = useState<Connection>('checking');
  const [origin, setOrigin] = useState<Origin>({ kind: 'me' });
  const [destination, setDestination] = useState<Place | null>(null);
  // true mientras el usuario está eligiendo otro origen con el botón "Cambiar".
  const [changingOrigin, setChangingOrigin] = useState(false);
  const [sort, setSort] = useState<SortMode>('fastest');
  // Opción tocada por el usuario (null = la primera de la lista).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Número de la última comprobación: si llega una respuesta vieja, se ignora.
  const checkId = useRef(0);

  // Comprueba si hay internet de verdad y guarda el resultado.
  const check = useCallback(async () => {
    const id = ++checkId.current;
    // Si ya hay conexión, se vuelve a comprobar en segundo plano para no perder lo escrito.
    setConnection((c) => (c === 'online' ? c : 'checking'));
    const online = await isOnline();
    if (id === checkId.current) setConnection(online ? 'online' : 'offline');
  }, []);

  // Se comprueba al abrir la pantalla y cada vez que la app vuelve a primer plano.
  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      sub.remove();
      checkId.current++; // al salir, se descartan las respuestas pendientes
    };
  }, [check]);

  // Una búsqueda sin red pasa la pantalla a "sin conexión".
  const goOffline = useCallback(() => {
    checkId.current++;
    setConnection('offline');
  }, []);

  const needsOrigin = origin.kind === 'me' && NO_POSITION.includes(status);
  const pickingOrigin = needsOrigin || changingOrigin;

  // Punto de salida: tu ubicación o el lugar elegido. Se separan lat y lon para que el objeto
  // no cambie si la posición no cambia (así no se recalcula todo en cada pintado).
  const originLat = origin.kind === 'me' ? coords?.lat : origin.place.lat;
  const originLon = origin.kind === 'me' ? coords?.lon : origin.place.lon;
  const from = useMemo<LatLon | null>(
    () => (originLat == null || originLon == null ? null : { lat: originLat, lon: originLon }),
    [originLat, originLon],
  );
  const to = useMemo<LatLon | null>(
    () => (destination ? { lat: destination.lat, lon: destination.lon } : null),
    [destination],
  );
  const ready = !pickingOrigin && from !== null && to !== null;

  // Las opciones de bus de hoy (se recalculan solo si cambian los puntos, los datos o el minuto).
  const options = useMemo(() => (ready ? planTrips(data, from, to, now) : []), [ready, data, from, to, now]);
  const sorted = useMemo(() => sortOptions(options, sort), [options, sort]);
  const selected = sorted.find((o) => o.id === selectedId) ?? sorted[0] ?? null;

  // Si el destino está muy cerca, se sugiere ir andando (los metros son una estimación).
  const walkInstead = useMemo(() => {
    if (!ready || distanceMeters(from, to) >= WALK_INSTEAD_METERS) return null;
    return estimateWalk(from, to);
  }, [ready, from, to]);

  // Lo que se dibuja en el mapa: origen y destino, la ruta elegida y sus paradas de subida, transbordo y bajada.
  const places = useMemo(
    () =>
      ready
        ? [
            { lat: from.lat, lon: from.lon, kind: 'origin' as const },
            { lat: to.lat, lon: to.lon, kind: 'destination' as const },
          ]
        : [],
    [ready, from, to],
  );
  const routes = useMemo(
    () => (selected ? selected.legs.map((l) => ({ coords: legCoords(l, data), colour: l.line.colour })) : []),
    [selected, data],
  );
  const mapStops = useMemo(() => {
    const seen = new Map<string, Stop>();
    for (const leg of selected?.legs ?? []) {
      seen.set(leg.from.code, leg.from);
      seen.set(leg.to.code, leg.to);
    }
    return [...seen.values()];
  }, [selected]);
  const bounds = useMemo(
    () => boundsOf([...places.map((p): [number, number] => [p.lon, p.lat]), ...routes.flatMap((r) => r.coords)]),
    [places, routes],
  );
  // La cámara solo se recoloca cuando la caja cambia de verdad (no cada minuto al recalcular).
  const recenter = useRef({ box: '', n: 0 });
  const box = bounds ? bounds.join() : '';
  if (recenter.current.box !== box) recenter.current = { box, n: recenter.current.n + 1 };
  // Origen y destino en el mismo punto: no hay caja que encuadrar, se centra ahí.
  const samePoint = bounds !== null && bounds[0] === bounds[2] && bounds[1] === bounds[3];

  if (connection === 'offline') {
    return (
      <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.background }]}>
        <OfflineNotice onRetry={check} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="subtitle">{t('directions.title')}</ThemedText>
        <ThemedText themeColor="textSecondary">{t('directions.subtitle')}</ThemedText>

        {connection === 'checking' ? (
          <ThemedText themeColor="textSecondary">{t('directions.checking')}</ThemedText>
        ) : (
          <>
            {needsOrigin ? <ThemedText type="smallBold">{t('directions.chooseOrigin')}</ThemedText> : (
              <View style={styles.row}>
                <ThemedText style={styles.grow}>
                  {origin.kind === 'me'
                    ? t('directions.fromMe')
                    : t('directions.fromPlace', { name: origin.place.name })}
                </ThemedText>
                <Pressable
                  onPress={() => setChangingOrigin((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={t('directions.changeOrigin')}
                  style={[styles.button, { backgroundColor: theme.backgroundSelected }]}
                >
                  <ThemedText type="smallBold">{t('directions.change')}</ThemedText>
                </Pressable>
              </View>
            )}

            {pickingOrigin ? (
              <>
                <PlaceSearch
                  placeholder={t('directions.originPlaceholder')}
                  onPick={(place) => {
                    setOrigin({ kind: 'place', place });
                    setChangingOrigin(false);
                  }}
                  onOffline={goOffline}
                />
                {changingOrigin && !needsOrigin ? (
                  <Pressable
                    onPress={() => {
                      setOrigin({ kind: 'me' });
                      setChangingOrigin(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('directions.useMyLocation')}
                    style={[styles.button, styles.start, { backgroundColor: theme.backgroundSelected }]}
                  >
                    <ThemedText type="smallBold">{t('directions.useMyLocation')}</ThemedText>
                  </Pressable>
                ) : null}
              </>
            ) : destination ? (
              <View style={styles.row}>
                <ThemedText style={styles.grow}>{t('directions.to', { name: destination.name })}</ThemedText>
                <Pressable
                  onPress={() => setDestination(null)}
                  accessibilityRole="button"
                  accessibilityLabel={t('directions.changeDestination')}
                  style={[styles.button, { backgroundColor: theme.backgroundSelected }]}
                >
                  <ThemedText type="smallBold">{t('directions.change')}</ThemedText>
                </Pressable>
              </View>
            ) : (
              <PlaceSearch
                placeholder={t('directions.destinationPlaceholder')}
                onPick={setDestination}
                onOffline={goOffline}
              />
            )}

            {ready ? (
              <>
                {walkInstead ? (
                  <ThemedText type="smallBold">
                    {t('directions.walkInstead', { meters: walkInstead.meters, minutes: walkInstead.minutes })}
                  </ThemedText>
                ) : null}
                <View style={styles.map}>
                  <JerezMap
                    height={MAP_HEIGHT}
                    bounds={samePoint ? undefined : (bounds ?? undefined)}
                    center={samePoint && bounds ? [bounds[0], bounds[1]] : undefined}
                    zoom={samePoint ? 15 : undefined}
                    recenterKey={recenter.current.n}
                    places={places}
                    routes={routes}
                    stops={mapStops}
                  />
                </View>
                {sorted.length === 0 ? (
                  <ThemedText themeColor="textSecondary">{t('directions.noBusesToday')}</ThemedText>
                ) : (
                  <>
                    <SortSelector
                      value={sort}
                      onChange={(mode) => {
                        setSort(mode);
                        setSelectedId(null);
                      }}
                    />
                    {sorted.map((option) => (
                      <RouteOptionCard
                        key={option.id}
                        option={option}
                        selected={option.id === selected?.id}
                        onPress={() => setSelectedId(option.id)}
                      />
                    ))}
                  </>
                )}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three, paddingBottom: BottomTabInset + Spacing.four, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  grow: { flex: 1 },
  start: { alignSelf: 'flex-start' },
  map: { borderRadius: Spacing.three, overflow: 'hidden' },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
});

// Si esta pantalla falla, se muestra su propio aviso y la barra de pestañas sigue visible.
export { RouteError as ErrorBoundary } from '@/components/RouteError';
