// Tarjeta de una parada cercana: nombre, distancia y, si está abierta, cada línea con su
// destino y su próximo bus de hoy. Cerrada solo enseña las insignias de sus líneas.
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { LineBadge } from '@/components/schedule/LineBadge';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useTheme } from '@/hooks/use-theme';
import { formatMinutes } from '@/lib/format';
import type { NearbyStop } from '@/lib/nearby';
import { dayTypeFor, headsignFor, nextDepartures } from '@/lib/schedule';

interface Props {
  item: NearbyStop;
  open: boolean;
  now: Date;
  onToggle: () => void;
  onSelectLine: (lineId: string, stopCode: string) => void;
}

export function NearbyStopCard({ item, open, now, onToggle, onSelectLine }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { data } = useData();
  const { stop } = item;
  const dayType = dayTypeFor(now, data.holidays);

  // "120 m · 2 min", y si la posición de la parada no es exacta, se avisa.
  let distance = t('nearby.distance', { meters: Math.round(item.meters), minutes: item.minutes });
  if (stop.approximate) distance += ` · ${t('nearby.approximate')}`;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={stop.name}
        accessibilityState={{ expanded: open }}
        style={styles.header}
      >
        <View style={styles.info}>
          <ThemedText type="smallBold" numberOfLines={2}>
            {stop.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {distance}
          </ThemedText>
        </View>
        {open ? null : (
          <View style={styles.badges}>
            {item.lines.map((line) => (
              <LineBadge key={line.id} line={line} />
            ))}
          </View>
        )}
      </Pressable>

      {open ? (
        <View style={styles.lines}>
          {item.lines.map((line) => {
            const times = line.timesByStop[stop.code]?.[dayType] ?? [];
            const next = nextDepartures(times, now, 1)[0];
            const headsign = headsignFor(line, stop.code);
            // Dos casos distintos: no hay horas hoy, o las hay pero ya pasaron.
            const status = next
              ? `${next.time} · ${formatMinutes(next.minutesUntil, t)}`
              : times.length === 0
                ? t('nearby.noServiceToday')
                : t('schedule.noMoreToday');
            return (
              <Pressable
                key={line.id}
                onPress={() => onSelectLine(line.id, stop.code)}
                accessibilityRole="button"
                accessibilityLabel={t('schedule.openFavorite', {
                  line: t('schedule.lineLabel', { id: line.id }),
                  stop: stop.name,
                })}
                style={styles.lineRow}
              >
                <LineBadge line={line} />
                <View style={styles.info}>
                  {headsign ? <ThemedText numberOfLines={1}>{t('nearby.towards', { headsign })}</ThemedText> : null}
                  <ThemedText type="small" themeColor="textSecondary">
                    {status}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.two, gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  info: { flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, maxWidth: '45%', justifyContent: 'flex-end' },
  lines: { gap: Spacing.two },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 44 },
});
