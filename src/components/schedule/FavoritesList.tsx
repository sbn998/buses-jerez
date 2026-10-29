// Lista de favoritos (línea + parada) con el próximo bus de hoy. Al tocar uno, se abre en Horarios.
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useTheme } from '@/hooks/use-theme';
import { formatMinutes } from '@/lib/format';
import { findLineStop } from '@/lib/lineStop';
import { dayTypeFor, nextDepartures } from '@/lib/schedule';
import type { Favorite } from '@/stores/favorites';

import { LineBadge } from './LineBadge';

interface Props {
  items: Favorite[];
  now: Date;
  onSelect: (f: Favorite) => void;
}

export function FavoritesList({ items, now, onSelect }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { data } = useData();

  if (items.length === 0) {
    return <ThemedText themeColor="textSecondary">{t('schedule.noFavorites')}</ThemedText>;
  }

  const dayType = dayTypeFor(now, data.holidays);
  return (
    <View style={styles.list}>
      {items.map((f) => {
        // Si los datos nuevos ya no traen esa línea o parada, o la línea ya no pasa por ella, se omite.
        const found = findLineStop(data, f.lineId, f.stopCode);
        if (!found) return null;
        const { line, stop } = found;
        const next = nextDepartures(line.timesByStop[f.stopCode]?.[dayType] ?? [], now, 1)[0];
        return (
          <Pressable
            key={`${f.lineId}-${f.stopCode}`}
            onPress={() => onSelect(f)}
            accessibilityRole="button"
            accessibilityLabel={t('schedule.openFavorite', {
              line: t('schedule.lineLabel', { id: line.id }),
              stop: stop.name,
            })}
            style={[styles.row, { backgroundColor: theme.backgroundElement }]}
          >
            <LineBadge line={line} />
            <View style={styles.info}>
              <ThemedText numberOfLines={1}>{stop.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {next
                  ? `${next.time} · ${formatMinutes(next.minutesUntil, t)}`
                  : t('schedule.noMoreToday')}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.two, borderRadius: Spacing.three },
  info: { flex: 1 },
});
