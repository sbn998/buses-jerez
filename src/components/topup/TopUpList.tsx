// Lista de puntos de recarga agrupados por zona: nombre, dirección y, si la hay, una nota (por ejemplo un horario).
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TopUpGroup } from '@/lib/topup';

export function TopUpList({ groups }: { groups: TopUpGroup[] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <>
      {groups.map((group) => (
        <View key={group.zone} style={styles.zone}>
          <ThemedText type="subtitle">{t(`topup.zone.${group.zone}`)}</ThemedText>
          {group.points.map((point) => (
            <View key={`${point.name}|${point.address}`} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">{point.name}</ThemedText>
              <ThemedText themeColor="textSecondary">{point.address}</ThemedText>
              {point.note ? <ThemedText type="small">{point.note}</ThemedText> : null}
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  zone: { gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
});
