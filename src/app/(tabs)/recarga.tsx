// Pestaña "Recarga": dónde se puede recargar la tarjeta, por zonas, según el cartel oficial de Comujesa.
// Funciona sin internet (la lista viene en los datos). El mapa llegará más adelante: de momento hay un recuadro.
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { TopUpList } from '@/components/topup/TopUpList';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useTheme } from '@/hooks/use-theme';
import { groupTopUp, TOPUP_URL } from '@/lib/topup';

export default function Recarga() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { data } = useData();
  const points = data.topUpPoints;
  const groups = useMemo(() => (points ? groupTopUp(points) : []), [points]);

  // "AAAA-MM-DD" → fecha local. Se construye a mano para que la zona horaria no cambie el día.
  const checked = data.topUpChecked
    ? (([y, m, d]) => new Date(y, m - 1, d).toLocaleDateString(i18n.language))(data.topUpChecked.split('-').map(Number))
    : null;

  const link = (
    <Pressable onPress={() => Linking.openURL(TOPUP_URL)} accessibilityRole="link">
      <ThemedText type="link">{t('topup.openWeb')}</ThemedText>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.map, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText themeColor="textSecondary">{t('nearby.mapSoon')}</ThemedText>
        </View>

        {points ? (
          <>
            <ThemedText type="subtitle">{t('topup.title')}</ThemedText>
            <TopUpList groups={groups} />
            <ThemedText type="small" themeColor="textSecondary">
              {checked ? t('topup.source', { date: checked }) : t('topup.sourceNoDate')}
            </ThemedText>
          </>
        ) : (
          <ThemedText>{t('topup.missing')}</ThemedText>
        )}
        {link}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three, paddingBottom: BottomTabInset + Spacing.four, gap: Spacing.three },
  map: { height: 96, borderRadius: Spacing.three, alignItems: 'center', justifyContent: 'center' },
});
