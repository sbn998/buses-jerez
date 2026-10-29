// Aviso que ocupa toda la pantalla de Cómo llego cuando no hay conexión: esta función necesita internet,
// así que no se dan resultados aproximados; solo se explica y se ofrece Reintentar.
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  onRetry: () => void;
}

export function OfflineNotice({ onRetry }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.screen}>
      <ThemedText type="subtitle">{t('directions.offlineTitle')}</ThemedText>
      <ThemedText themeColor="textSecondary">{t('directions.offlineText')}</ThemedText>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t('directions.retry')}
        style={[styles.button, { backgroundColor: theme.backgroundSelected }]}
      >
        <ThemedText type="smallBold">{t('directions.retry')}</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: Spacing.three, gap: Spacing.three },
  button: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
});
