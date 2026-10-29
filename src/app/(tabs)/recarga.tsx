// Pestaña "Recarga": dónde se puede recargar la tarjeta, por zonas, según el cartel oficial de Comujesa.
// Funciona sin internet (la lista viene en los datos). El mapa enseña los puntos que tienen coordenadas;
// los que no, solo salen en la lista. Al tocar un punto del mapa se destaca su tarjeta y la lista se desplaza hasta ella.
import { type ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JerezMap, type MapStatus } from '@/components/map/JerezMap';
import { ThemedText } from '@/components/themed-text';
import { TopUpList } from '@/components/topup/TopUpList';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useTheme } from '@/hooks/use-theme';
import bundledJson from '@/data/bundled.json';
import type { Dataset, Stop, TopUpPoint } from '@/data/schema';
import { boundsOf } from '@/lib/mapLayers';
import { formatCheckedDate, groupTopUp, TOPUP_URL, topUpFor } from '@/lib/topup';

const MAP_HEIGHT = 220;

export default function Recarga() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { data } = useData();
  // Si los datos descargados son antiguos y no traen puntos, se usa la copia incluida en la app.
  const { points, checked: checkedText } = topUpFor(data, bundledJson as unknown as Dataset);
  const groups = useMemo(() => (points ? groupTopUp(points) : []), [points]);
  // Fecha legible, o null si no se puede leer (entonces no se escribe "revisado el …").
  const checked = formatCheckedDate(checkedText, i18n.language);

  // Puntos con coordenadas, convertidos en "paradas" para reutilizar el dibujo de JerezMap.
  // El código de cada uno es su posición en la lista; los que no tienen coordenadas no se dibujan (nunca en 0,0).
  const mapPoints = useMemo(() => {
    const stops: Stop[] = [];
    const byCode = new Map<string, TopUpPoint>();
    (points ?? []).forEach((p, i) => {
      if (p.lat === undefined || p.lon === undefined) return;
      const code = String(i);
      stops.push({ code, name: p.name, description: p.address, lat: p.lat, lon: p.lon, coordSource: 'osm', approximate: p.approximate === true });
      byCode.set(code, p);
    });
    return { stops, byCode };
  }, [points]);
  const hasApproximate = mapPoints.stops.some((s) => s.approximate);
  // Encuadre: una caja con todos los puntos dibujados; con menos de dos sitios distintos, Jerez con zoom 12.
  const mapView = useMemo(() => {
    const box = boundsOf(mapPoints.stops.map((s): [number, number] => [s.lon, s.lat]));
    if (box && (box[0] !== box[2] || box[1] !== box[3])) return { bounds: box };
    return { center: [-6.1365, 36.6813] as [number, number], zoom: 12 };
  }, [mapPoints]);
  // Estado del mapa: la leyenda del círculo hueco solo se enseña si el mapa no está en modo "unavailable" (solo recuadro de texto).
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');

  // Tocar un punto en el mapa: destaca su tarjeta y pide desplazarse hasta ella.
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const cardY = useRef(new Map<TopUpPoint, number>());
  const [focus, setFocus] = useState<{ point: TopUpPoint; n: number } | null>(null);
  const openFromMap = useCallback(
    (code: string) => {
      const point = mapPoints.byCode.get(code);
      if (point) setFocus((prev) => ({ point, n: (prev?.n ?? 0) + 1 }));
    },
    [mapPoints],
  );
  useEffect(() => {
    if (!focus) return;
    const y = cardY.current.get(focus.point);
    if (y != null) scrollRef.current?.scrollTo({ y, animated: true });
  }, [focus]);

  const link = (
    <Pressable onPress={() => Linking.openURL(TOPUP_URL)} accessibilityRole="link">
      <ThemedText type="link">{t('topup.openWeb')}</ThemedText>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <View style={styles.mapBox}>
          <JerezMap height={MAP_HEIGHT} {...mapView} stops={mapPoints.stops} onStopPress={openFromMap} onStatusChange={setMapStatus} />
          {hasApproximate && mapStatus !== 'unavailable' ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('nearby.approxLegend')}
            </ThemedText>
          ) : null}
        </View>

        {points ? (
          <>
            <ThemedText type="subtitle">{t('topup.title')}</ThemedText>
            <TopUpList
              groups={groups}
              selected={focus?.point}
              onCardLayout={(point, y) => cardY.current.set(point, y)}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {checked ? t('topup.source', { date: checked }) : t('topup.sourceNoDate')}
            </ThemedText>
          </>
        ) : (
          <ThemedText>{t('topup.missing')}</ThemedText>
        )}
        {link}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three, paddingBottom: BottomTabInset + Spacing.four, gap: Spacing.three },
  mapBox: { gap: Spacing.one },
});

// Si esta pantalla falla, se muestra su propio aviso y la barra de pestañas sigue visible.
export { RouteError as ErrorBoundary } from '@/components/RouteError';
