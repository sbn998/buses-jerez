// Pestaña "Cerca de mí": favoritos con su próximo bus, y las paradas a menos de 500 m de donde
// estás (la más cercana abierta). El mapa llegará más adelante: de momento hay un recuadro.
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { openSchedule } from '@/lib/navigation';
import { useFavorites } from '@/stores/favorites';

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

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="subtitle">{t('schedule.favorites')}</ThemedText>
        <FavoritesList items={favorites} now={now} onSelect={(f) => openSchedule(router, f.lineId, f.stopCode)} />

        <View style={[styles.map, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText themeColor="textSecondary">{t('nearby.mapSoon')}</ThemedText>
        </View>

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
                <NearbyStopCard
                  key={item.stop.code}
                  item={item}
                  showMinutes={!approximate}
                  now={now}
                  open={toggled[item.stop.code] ?? index === 0}
                  onToggle={() =>
                    setToggled((prev) => ({ ...prev, [item.stop.code]: !(prev[item.stop.code] ?? index === 0) }))
                  }
                  onSelectLine={(lineId, stopCode) => openSchedule(router, lineId, stopCode)}
                />
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
  map: { height: 96, borderRadius: Spacing.three, alignItems: 'center', justifyContent: 'center' },
});
