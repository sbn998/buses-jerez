// Detalle de una línea: hueco para el mapa y, por cada sentido, sus paradas numeradas en orden.
// Al tocar una parada se abre Horarios con esa línea y parada.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StopRow } from '@/components/lines/StopRow';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type { Stop } from '@/data/schema';
import { useTheme } from '@/hooks/use-theme';
import { openSchedule } from '@/lib/navigation';

export default function LineaDetalle() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { data } = useData();
  const { id } = useLocalSearchParams<{ id: string }>();
  const line = data.lines.find((l) => l.id === id);

  // Un bloque por sentido. Con un solo sentido se titula "Recorrido" (no se inventa un "Hacia …").
  const sections = useMemo(() => {
    if (!line) return [];
    return line.directions.map((direction) => ({
      title: line.directions.length === 1 ? t('lines.route') : t('schedule.towards', { headsign: direction.headsign }),
      data: direction.stopCodes.flatMap((code) => (data.stops[code] ? [data.stops[code]] : [])),
    }));
  }, [line, data, t]);

  if (!line) {
    return (
      <SafeAreaView edges={['left', 'right']} style={[styles.screen, styles.notFound, { backgroundColor: theme.background }]}>
        <ThemedText type="subtitle">{t('lines.notFound')}</ThemedText>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          style={[styles.backButton, { backgroundColor: theme.backgroundElement }]}
        >
          <ThemedText type="smallBold">{t('lines.back')}</ThemedText>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.background }]}>
      <SectionList<Stop, { title: string; data: Stop[] }>
        sections={sections}
        // Una misma parada puede salir en los dos sentidos: la clave incluye la posición.
        keyExtractor={(stop, index) => `${stop.code}-${index}`}
        initialNumToRender={20}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={[styles.map, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText themeColor="textSecondary">{t('nearby.mapSoon')}</ThemedText>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {section.title}
          </ThemedText>
        )}
        renderItem={({ item, index }) => (
          <StopRow stop={item} position={index + 1} onPress={() => openSchedule(router, line.id, item.code)} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three, paddingBottom: BottomTabInset + Spacing.four },
  notFound: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.three },
  backButton: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.four, borderRadius: Spacing.two },
  map: { height: 160, borderRadius: Spacing.three, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  sectionTitle: { marginTop: Spacing.three, marginBottom: Spacing.two },
});
