// Fila de la lista de líneas: insignia de color con el número y el nombre ("Esteve - San Telmo").
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LineBadge } from '@/components/schedule/LineBadge';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Line } from '@/data/schema';
import { useTheme } from '@/hooks/use-theme';

export function LineRow({ line, onPress }: { line: Line; onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('schedule.lineLabel', { id: line.id })}
      style={[styles.row, { backgroundColor: theme.backgroundElement }]}
    >
      <LineBadge line={line} />
      <ThemedText style={styles.name} numberOfLines={2}>
        {line.name}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Spacing.three },
  name: { flex: 1 },
});
