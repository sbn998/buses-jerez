// Tira de días (calendario): cada día lleva un color según su tipo (laborable, sábado,
// domingo/festivo), con una leyenda debajo. El día elegido se marca con un borde.
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { DayType } from '@/data/schema';
import { useTheme } from '@/hooks/use-theme';

export interface StripDay {
  date: Date;
  key: string;
  dayType: DayType;
}

// Un color por tipo de día (con texto blanco encima).
export const DAY_COLOURS: Record<DayType, string> = {
  lab: '#2563EB',
  sab: '#B45309',
  fes: '#BE123C',
};
const DAY_KEYS: Record<DayType, string> = {
  lab: 'schedule.dayLab',
  sab: 'schedule.daySab',
  fes: 'schedule.dayFes',
};

interface Props {
  days: StripDay[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

export function DayStrip({ days, selectedKey, onSelect }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  return (
    <View testID="day-strip" style={styles.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {days.map((day, index) => {
          const selected = day.key === selectedKey;
          const weekday =
            index === 0 ? t('schedule.today') : day.date.toLocaleDateString(i18n.language, { weekday: 'short' });
          const fullDate = day.date.toLocaleDateString(i18n.language, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });
          return (
            <Pressable
              key={day.key}
              onPress={() => onSelect(day.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${t('schedule.selectDay', { date: fullDate })}, ${t(DAY_KEYS[day.dayType])}`}
              style={[
                styles.day,
                { backgroundColor: DAY_COLOURS[day.dayType], borderColor: selected ? theme.text : 'transparent' },
              ]}
            >
              <ThemedText type="small" style={styles.light}>
                {weekday}
              </ThemedText>
              <ThemedText type="smallBold" style={styles.light}>
                {day.date.getDate()}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.legend}>
        {(Object.keys(DAY_COLOURS) as DayType[]).map((type) => (
          <View key={type} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: DAY_COLOURS[type] }]} />
            <ThemedText type="small" themeColor="textSecondary">
              {t(DAY_KEYS[type])}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.two },
  row: { gap: Spacing.two },
  day: { width: 52, paddingVertical: Spacing.two, borderRadius: Spacing.two, borderWidth: 3, alignItems: 'center' },
  light: { color: '#FFFFFF', textTransform: 'capitalize' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
