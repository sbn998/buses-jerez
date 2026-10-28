// Tarjeta de próximo bus: la siguiente salida en grande con "en N min" y las salidas siguientes.
// Solo se enseña cuando el día elegido es hoy.
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { TimeOfDay } from '@/data/schema';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  departures: { time: TimeOfDay; minutesUntil: number }[];
  headsign: string | null;
}

export function NextBusCard({ departures, headsign }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [first, ...others] = departures;
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {t('schedule.nextBus')}
      </ThemedText>
      {headsign ? <ThemedText type="smallBold">{t('schedule.towards', { headsign })}</ThemedText> : null}
      {first ? (
        <>
          <View style={styles.big}>
            <ThemedText style={styles.time}>{first.time}</ThemedText>
            <ThemedText themeColor="textSecondary">
              {t('schedule.inMinutes', { minutes: first.minutesUntil })}
            </ThemedText>
          </View>
          {others.length > 0 ? (
            <View style={styles.others}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('schedule.thenBuses')}
              </ThemedText>
              {others.map((d) => (
                <ThemedText key={d.time} type="smallBold">
                  {d.time}
                </ThemedText>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <ThemedText>{t('schedule.noMoreToday')}</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  big: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  time: { fontSize: 40, lineHeight: 48, fontWeight: '700' },
  others: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
