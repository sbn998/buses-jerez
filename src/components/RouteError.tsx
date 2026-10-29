// Pantalla de error de una pestaña: si falla una sola pantalla, el aviso aparece dentro de ella
// y la barra de pestañas sigue visible. Cada archivo de pantalla la reexporta como ErrorBoundary.
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import i18n from '@/i18n';

type Props = { error: Error; retry: () => void };

export function RouteError({ error, retry }: Props) {
  // Solo en desarrollo, deja el error en la consola para poder investigarlo.
  useEffect(() => {
    if (__DEV__) console.warn('RouteError:', error);
  }, [error]);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle">{i18n.t('error.routeTitle')}</ThemedText>
      <Pressable accessibilityRole="button" onPress={retry} style={styles.button}>
        <ThemedText type="link">{i18n.t('error.retry')}</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  button: { paddingVertical: 12, paddingHorizontal: 24, minHeight: 44, justifyContent: 'center' },
});
