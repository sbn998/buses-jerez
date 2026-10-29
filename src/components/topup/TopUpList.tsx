// Lista de puntos de recarga agrupados por zona: nombre, dirección y, si la hay, una nota (por ejemplo un horario).
// Si se le indica un punto seleccionado (por ejemplo, tocado en el mapa), su tarjeta se destaca con un borde.
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TopUpPoint } from '@/data/schema';
import type { TopUpGroup } from '@/lib/topup';

type Props = {
  groups: TopUpGroup[];
  /** Punto destacado (mismo objeto que está en `groups`). */
  selected?: TopUpPoint | null;
  /** Avisa de dónde está cada tarjeta (y desde lo alto de la lista) para poder desplazarse hasta ella. */
  onCardLayout?: (point: TopUpPoint, y: number) => void;
};

export function TopUpList({ groups, selected, onCardLayout }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  // Posición de cada zona dentro de la lista; la de la tarjeta se mide dentro de su zona y se suma.
  const zoneY = useRef<Record<string, number>>({});
  return (
    <>
      {groups.map((group) => (
        <View
          key={group.zone}
          style={styles.zone}
          onLayout={(e) => {
            zoneY.current[group.zone] = e.nativeEvent.layout.y;
          }}
        >
          <ThemedText type="subtitle">{t(`topup.zone.${group.zone}`)}</ThemedText>
          {group.points.map((point) => {
            const isSelected = point === selected;
            return (
              <View
                key={`${point.name}|${point.address}`}
                testID={isSelected ? 'topup-card-selected' : undefined}
                onLayout={(e) => onCardLayout?.(point, (zoneY.current[group.zone] ?? 0) + e.nativeEvent.layout.y)}
                style={[
                  styles.card,
                  { backgroundColor: theme.backgroundElement },
                  isSelected && { borderColor: theme.text, borderWidth: 2 },
                ]}
              >
                <ThemedText type="smallBold">{point.name}</ThemedText>
                <ThemedText themeColor="textSecondary">{point.address}</ThemedText>
                {point.note ? <ThemedText type="small">{point.note}</ThemedText> : null}
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  zone: { gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half, borderWidth: 2, borderColor: 'transparent' },
});
