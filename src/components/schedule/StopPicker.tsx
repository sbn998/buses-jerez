// Selector de parada: lista con las paradas de la línea en orden de recorrido,
// agrupadas por sentido ("Hacia San Telmo"). Tiene altura limitada y se desplaza,
// porque algunas líneas tienen más de 80 paradas.
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Line, Stop } from '@/data/schema';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  line: Line;
  stops: Record<string, Stop>;
  onSelect: (stopCode: string) => void;
}

export function StopPicker({ line, stops, onSelect }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  // Si la línea no trae sentidos, se usa el recorrido completo en un solo grupo.
  const groups = line.directions.length
    ? line.directions
    : [{ headsign: '', stopCodes: line.stopCodes }];

  return (
    <ScrollView style={[styles.list, { backgroundColor: theme.backgroundElement }]} nestedScrollEnabled>
      {groups.map((group, index) => (
        <View key={`${group.headsign}-${index}`}>
          {/* Con un solo sentido no se escribe "Hacia …". */}
          {group.headsign && line.directions.length > 1 ? (
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.header}>
              {t('schedule.towards', { headsign: group.headsign })}
            </ThemedText>
          ) : null}
          {group.stopCodes.map((code) => (
            <Pressable
              key={code}
              onPress={() => onSelect(code)}
              accessibilityRole="button"
              accessibilityLabel={stops[code]?.name ?? code}
              style={styles.row}
            >
              <ThemedText>{stops[code]?.name ?? code}</ThemedText>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 420, borderRadius: Spacing.two },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.one },
  row: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, minHeight: 44, justifyContent: 'center' },
});
