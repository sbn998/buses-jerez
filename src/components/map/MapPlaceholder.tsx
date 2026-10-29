// Recuadro que se muestra en lugar del mapa cuando no se puede cargar (sin conexión, sin módulo nativo...).
// Así el mapa nunca bloquea la pantalla: el resto de la pantalla sigue funcionando.
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export function MapPlaceholder({ height }: { height: number }) {
  const { t } = useTranslation();
  return (
    <ThemedView type="backgroundElement" style={[styles.box, { height }]}>
      <ThemedText themeColor="textSecondary">{t('map.unavailable')}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
});
