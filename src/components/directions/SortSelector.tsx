// Selector de orden de Cómo llego: tres botones (Más rápido, Menos andar, Menos transbordos).
// El elegido se ve marcado y avisa a la pantalla con onChange.
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SortMode } from '@/lib/planner';

interface Props {
  value: SortMode;
  onChange: (mode: SortMode) => void;
}

// Cada modo con la clave de su texto.
const MODES: { mode: SortMode; key: string }[] = [
  { mode: 'fastest', key: 'directions.sortFastest' },
  { mode: 'leastWalking', key: 'directions.sortLeastWalking' },
  { mode: 'fewestTransfers', key: 'directions.sortFewestTransfers' },
];

export function SortSelector({ value, onChange }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityLabel={t('directions.sortLabel')}>
      {MODES.map(({ mode, key }) => {
        const selected = mode === value;
        return (
          <Pressable
            key={mode}
            onPress={() => onChange(mode)}
            accessibilityRole="button"
            accessibilityLabel={t(key)}
            accessibilityState={{ selected }}
            style={[styles.button, { backgroundColor: selected ? theme.text : theme.backgroundSelected }]}
          >
            <ThemedText type="smallBold" style={{ color: selected ? theme.background : theme.text }}>
              {t(key)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
