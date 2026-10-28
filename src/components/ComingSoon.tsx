// Pantalla de relleno para las pestañas que aún no están hechas.
// Muestra el título de la pestaña y el texto "Próximamente".
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export function ComingSoon({ title }: { title: string }) {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{title}</ThemedText>
      {/* Texto fijo de momento; en la Task 2 saldrá de i18n */}
      <ThemedText themeColor="textSecondary">Próximamente</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
