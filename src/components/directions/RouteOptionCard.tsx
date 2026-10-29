// Tarjeta de una opción de ruta de Cómo llego: las líneas (insignias con su color), el resumen,
// dónde subirse, el transbordo si lo hay y dónde bajarse. Al tocarla, la pantalla la marca como elegida.
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { textColourFor } from '@/lib/colour';
import type { RouteOption } from '@/lib/planner';

interface Props {
  option: RouteOption;
  selected: boolean;
  onPress: () => void;
}

export function RouteOptionCard({ option, selected, onPress }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const first = option.legs[0];
  const last = option.legs[option.legs.length - 1];
  const transfers = option.legs.length - 1;
  return (
    <Pressable
      testID={`route-option-${option.legs.map((l) => l.line.id).join('-')}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: selected ? theme.text : 'transparent' },
      ]}
    >
      <View style={styles.badges}>
        {option.legs.map((leg, i) => (
          <View
            key={i}
            testID={`badge-${leg.line.id}`}
            style={[styles.badge, { backgroundColor: leg.line.colour }]}
          >
            <ThemedText type="smallBold" style={{ color: textColourFor(leg.line.colour) }}>
              {leg.line.id}
            </ThemedText>
          </View>
        ))}
      </View>
      <ThemedText type="smallBold">
        {t('directions.summary', {
          minutes: option.totalMinutes,
          meters: option.walkMeters,
          kind: transfers === 0 ? t('directions.direct') : t('directions.oneTransfer'),
        })}
      </ThemedText>
      <ThemedText>
        {t('directions.board', {
          stop: first.from.name,
          time: first.departure,
          meters: option.walkToStop.meters,
        })}
      </ThemedText>
      {transfers > 0 && option.transferWaitMinutes !== null ? (
        <ThemedText>
          {t('directions.transfer', { stop: first.to.name, minutes: option.transferWaitMinutes })}
        </ThemedText>
      ) : null}
      <ThemedText>
        {t('directions.alight', {
          stop: last.to.name,
          time: last.arrival,
          meters: option.walkFromStop.meters,
        })}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('directions.approxDistances')}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, borderWidth: 2, gap: Spacing.one },
  badges: { flexDirection: 'row', gap: Spacing.two },
  badge: { minWidth: 32, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Spacing.two, alignItems: 'center' },
});
