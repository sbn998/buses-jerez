// Pantalla de relleno para las pestañas que aún no están hechas.
// Muestra el título de la pestaña y el texto "Próximamente" (traducido).
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export function ComingSoon({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{title}</ThemedText>
      <ThemedText themeColor="textSecondary">{t('common.comingSoon')}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
