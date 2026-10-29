// Pantalla Opciones: idioma, de dónde salen los datos y (pronto) el mapa sin conexión.
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { LanguagePicker } from '@/components/options/LanguagePicker';
import { DataFreshness } from '@/components/schedule/DataFreshness';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function Opciones() {
  const { t } = useTranslation();
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="smallBold">{t('options.language')}</ThemedText>
        <LanguagePicker />

        <ThemedText type="smallBold" style={styles.section}>
          {t('options.data')}
        </ThemedText>
        <ThemedText>{t('options.source')}</ThemedText>
        <DataFreshness />

        <ThemedText type="smallBold" style={styles.section}>
          {t('options.offlineMap')}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{t('options.mapSoon')}</ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 8 },
  section: { marginTop: 24 },
});
