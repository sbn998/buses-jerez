// Tarjeta de una opción de ruta de Cómo llego: las líneas (insignias con su color), el resumen,
// dónde subirse, el transbordo si lo hay y dónde bajarse. Al tocarla, la pantalla la marca como elegida.
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { textColourFor } from '@/lib/colour';
import type { RouteOption } from '@/lib/planner';
import { directionLabel } from '@/lib/schedule';

interface Props {
  option: RouteOption;
  selected: boolean;
  onPress: () => void;
}

// Nombre de la parada con su código, porque dos paradas de aceras opuestas pueden llamarse igual.
const stopLabel = (stop: { name: string; code: string }) => `${stop.name} (${stop.code})`;

export function RouteOptionCard({ option, selected, onPress }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const first = option.legs[0];
  const last = option.legs[option.legs.length - 1];
  const second = option.legs[1];
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
      {/* "Línea X hacia …" de cada bus; si la línea no tiene dos sentidos, no se escribe nada. */}
      {option.legs.map((leg, i) => {
        const headsign = directionLabel(leg.line, leg.from.code);
        return headsign ? (
          <ThemedText key={i} type="small" themeColor="textSecondary">
            {t('directions.lineTowards', { line: leg.line.id, headsign })}
          </ThemedText>
        ) : null;
      })}
      <ThemedText>
        {t('directions.board', {
          stop: first.from.name,
          time: first.departure,
          meters: option.walkToStop.meters,
        })}
      </ThemedText>
      {second && option.transferWalk ? (
        // Hay que andar de una parada a otra (a veces con el mismo nombre en la otra acera):
        // se dice dónde bajar, cuánto andar y dónde subir, con el código para distinguirlas.
        <>
          <ThemedText>
            {t('directions.transferWalk', {
              from: stopLabel(first.to),
              meters: option.transferWalk.meters,
              to: stopLabel(second.from),
            })}
          </ThemedText>
          <ThemedText>
            {t('directions.boardNext', {
              line: second.line.id,
              stop: stopLabel(second.from),
              time: second.departure,
            })}
          </ThemedText>
        </>
      ) : second && option.transferWaitMinutes !== null ? (
        // Transbordo en la misma parada: se espera y se sube al segundo bus.
        <>
          <ThemedText>
            {t('directions.transfer', { stop: first.to.name, minutes: option.transferWaitMinutes })}
          </ThemedText>
          <ThemedText>
            {t('directions.boardNextSame', { line: second.line.id, time: second.departure })}
          </ThemedText>
        </>
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
