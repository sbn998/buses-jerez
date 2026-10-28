// Rejilla con todas las horas de paso del día. Si highlightNext es true (el día elegido es hoy),
// las horas ya pasadas salen en gris y la siguiente resaltada.
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { TimeOfDay } from '@/data/schema';
import { useTheme } from '@/hooks/use-theme';
import { minutesOfDay } from '@/lib/schedule';

interface Props {
  times: TimeOfDay[];
  now?: Date;
  highlightNext: boolean;
}

export function TimesGrid({ times, now = new Date(), highlightNext }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (times.length === 0) {
    return <ThemedText themeColor="textSecondary">{t('schedule.noService')}</ThemedText>;
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  // La siguiente es la primera hora que aún no ha pasado (las horas vienen ordenadas).
  const nextIndex = highlightNext ? times.findIndex((time) => minutesOfDay(time) >= nowMinutes) : -1;

  return (
    <View style={styles.grid}>
      {times.map((time, index) => {
        const isNext = index === nextIndex;
        const isPast = highlightNext && (nextIndex === -1 || index < nextIndex);
        return (
          <View
            key={`${time}-${index}`}
            testID={isNext ? 'time-next' : isPast ? 'time-past' : undefined}
            style={[styles.cell, { backgroundColor: isNext ? theme.text : theme.backgroundElement }]}
          >
            <ThemedText
              type={isNext ? 'smallBold' : 'small'}
              style={
                isNext
                  ? { color: theme.background }
                  : isPast
                    ? { color: theme.textSecondary, opacity: 0.6 }
                    : undefined
              }
            >
              {time}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cell: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
    minWidth: 60,
    alignItems: 'center',
  },
});
