// Pantalla de relleno para las pestañas que aún no están hechas.
// Solo muestra el texto "Próximamente" (traducido): el título ya sale en la cabecera de la pestaña.
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export function ComingSoon() {
  const { t } = useTranslation();
  return (
    <ThemedView style={styles.container}>
      <ThemedText themeColor="textSecondary">{t('common.comingSoon')}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
