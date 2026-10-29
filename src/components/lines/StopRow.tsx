// Fila de una parada dentro del recorrido de una línea: número de orden, nombre y, si su
// posición no es exacta, el aviso "ubicación aproximada". Al tocarla se abre Horarios.
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Stop } from '@/data/schema';
import { useTheme } from '@/hooks/use-theme';

export function StopRow({ stop, position, onPress }: { stop: Stop; position: number; onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const approximate = t('nearby.approximate');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${position}. ${stop.name}${stop.approximate ? `, ${approximate}` : ''}`}
      style={[styles.row, { backgroundColor: theme.backgroundElement }]}
    >
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.number}>
        {position}
      </ThemedText>
      <View style={styles.info}>
        <ThemedText numberOfLines={2}>{stop.name}</ThemedText>
        {stop.approximate ? (
          <ThemedText type="small" themeColor="textSecondary">
            {approximate}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.two, marginBottom: Spacing.one },
  number: { width: 28, textAlign: 'right' },
  info: { flex: 1 },
});
