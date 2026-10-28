// Selector de línea: una rejilla con todas las líneas (su número sobre su color).
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Line } from '@/data/schema';

import { LineBadge } from './LineBadge';

export function LinePicker({ lines, onSelect }: { lines: Line[]; onSelect: (lineId: string) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.grid}>
      {lines.map((line) => (
        <Pressable
          key={line.id}
          onPress={() => onSelect(line.id)}
          accessibilityRole="button"
          accessibilityLabel={`${t('schedule.lineLabel', { id: line.id })}, ${line.name}`}
          style={styles.item}
        >
          <LineBadge line={line} />
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.name}>
            {line.name}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  item: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  name: { flex: 1 },
});
