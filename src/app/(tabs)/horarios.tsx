// Pestaña "Horarios": el usuario elige línea y parada (o llega con ?line=<id>&stop=<code>) y ve
// el próximo bus, la tira de días y todas las horas del día elegido.
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DataFreshness } from '@/components/schedule/DataFreshness';
import { DayStrip } from '@/components/schedule/DayStrip';
import { FavoritesList } from '@/components/schedule/FavoritesList';
import { LineBadge } from '@/components/schedule/LineBadge';
import { LinePicker } from '@/components/schedule/LinePicker';
import { NextBusCard } from '@/components/schedule/NextBusCard';
import { StopPicker } from '@/components/schedule/StopPicker';
import { TimesGrid } from '@/components/schedule/TimesGrid';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useTheme } from '@/hooks/use-theme';
import { calendarDays, headsignFor, nextDepartures, toDateKey } from '@/lib/schedule';
import { useFavorites } from '@/stores/favorites';

export default function Horarios() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { data } = useData();
  const params = useLocalSearchParams<{ line?: string; stop?: string }>();
  const favorites = useFavorites((s) => s.items);
  const toggleFavorite = useFavorites((s) => s.toggle);

  const [lineId, setLineId] = useState<string | null>(params.line ?? null);
  const [stopCode, setStopCode] = useState<string | null>(params.stop ?? null);
  // null = "hoy" (así el día elegido sigue siendo hoy aunque pase la medianoche).
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Si llegan parámetros nuevos (por ejemplo desde otra pestaña), se aplican.
  useEffect(() => {
    if (params.line) {
      setLineId(params.line);
      setStopCode(params.stop ?? null);
      setSelectedKey(null);
    }
  }, [params.line, params.stop]);

  // La hora actual se refresca cada minuto para que "en N min" no se quede desfasado.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const line = data.lines.find((l) => l.id === lineId) ?? null;
  // Solo vale una parada que pertenezca a la línea (si no, se ignora).
  const stop = line && stopCode && line.stopCodes.includes(stopCode) ? data.stops[stopCode] ?? null : null;

  const days = useMemo(() => calendarDays(now, 14, data.holidays), [now, data.holidays]);
  const todayKey = toDateKey(now);
  const effectiveKey = selectedKey ?? todayKey;
  const selectedDay = days.find((d) => d.key === effectiveKey) ?? days[0];
  const isToday = effectiveKey === todayKey;

  const chooseLine = (id: string) => {
    setLineId(id);
    setStopCode(null); // al cambiar de línea se reinicia la parada
  };

  let content;
  if (!line) {
    content = (
      <>
        <ThemedText type="subtitle">{t('schedule.favorites')}</ThemedText>
        <FavoritesList
          items={favorites}
          now={now}
          onSelect={(f) => {
            setLineId(f.lineId);
            setStopCode(f.stopCode);
            setSelectedKey(null);
          }}
        />
        <ThemedText type="subtitle">{t('schedule.chooseLine')}</ThemedText>
        <LinePicker lines={data.lines} onSelect={chooseLine} />
      </>
    );
  } else if (!stop) {
    content = (
      <>
        <View style={styles.row}>
          <LineBadge line={line} />
          <ThemedText style={styles.grow} numberOfLines={2}>
            {line.name}
          </ThemedText>
          <ChangeButton label={t('schedule.changeLine')} onPress={() => setLineId(null)} />
        </View>
        <ThemedText type="subtitle">{t('schedule.chooseStop')}</ThemedText>
        <StopPicker line={line} stops={data.stops} onSelect={setStopCode} />
      </>
    );
  } else {
    const favorite = { lineId: line.id, stopCode: stop.code };
    const isFavorite = favorites.some((f) => f.lineId === favorite.lineId && f.stopCode === favorite.stopCode);
    const times = line.timesByStop[stop.code]?.[selectedDay.dayType] ?? [];
    const headsign = headsignFor(line, stop.code);
    content = (
      <>
        <View style={styles.row}>
          <LineBadge line={line} />
          <View style={styles.grow}>
            <ThemedText type="subtitle" style={styles.stopName}>
              {stop.name}
            </ThemedText>
            {headsign ? (
              <ThemedText themeColor="textSecondary">{t('schedule.towards', { headsign })}</ThemedText>
            ) : null}
          </View>
          <Pressable
            onPress={() => toggleFavorite(favorite)}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? t('schedule.removeFavorite') : t('schedule.addFavorite')}
            accessibilityState={{ selected: isFavorite }}
            hitSlop={8}
            style={styles.star}
          >
            <ThemedText style={styles.starText}>{isFavorite ? '★' : '☆'}</ThemedText>
          </Pressable>
        </View>
        <View style={styles.row}>
          <ChangeButton label={t('schedule.changeLine')} onPress={() => setLineId(null)} />
          <ChangeButton label={t('schedule.changeStop')} onPress={() => setStopCode(null)} />
        </View>
        <DayStrip days={days} selectedKey={effectiveKey} onSelect={setSelectedKey} />
        {selectedDay.holiday ? (
          <ThemedText type="smallBold">{selectedDay.holiday.name}</ThemedText>
        ) : null}
        {isToday ? <NextBusCard departures={nextDepartures(times, now, 4)} headsign={headsign} /> : null}
        <ThemedText type="smallBold">{t('schedule.allTimes')}</ThemedText>
        <TimesGrid times={times} now={now} highlightNext={isToday} />
      </>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="subtitle">{t('tabs.schedules')}</ThemedText>
        {content}
        <DataFreshness />
      </ScrollView>
    </SafeAreaView>
  );
}

// Botón de texto pequeño ("Cambiar línea", "Cambiar parada").
function ChangeButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.change, { backgroundColor: theme.backgroundElement }]}
    >
      <ThemedText type="small">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three, paddingBottom: BottomTabInset + Spacing.four, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  grow: { flex: 1 },
  stopName: { fontSize: 24, lineHeight: 30 },
  star: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  starText: { fontSize: 32, lineHeight: 38 },
  change: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.three, minHeight: 36, justifyContent: 'center' },
});
