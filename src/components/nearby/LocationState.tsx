// Aviso que se muestra en Cerca de mí mientras no hay posición: pidiendo permiso, permiso
// denegado, no disponible o sin señal GPS (botón para volver a intentarlo), permiso bloqueado (botón a los ajustes) o buscando.
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { LocationStatus } from '@/hooks/use-location';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  status: Exclude<LocationStatus, 'ready'>;
  onRetry: () => void;
}

export function LocationState({ status, onRetry }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (status === 'asking' || status === 'waiting') {
    return <ThemedText themeColor="textSecondary">{t(`nearby.${status}`)}</ThemedText>;
  }

  const isBlocked = status === 'blocked';
  const bodyText = isBlocked
    ? t('nearby.blockedText')
    : status === 'unavailable'
      ? t('nearby.unavailableText')
      : status === 'nosignal'
        ? t('nearby.nosignalText')
        : t('nearby.deniedText');
  const buttonLabel = isBlocked ? t('nearby.openSettings') : t('nearby.allowLocation');
  return (
    <View style={styles.box}>
      <ThemedText>{bodyText}</ThemedText>
      <Pressable
        onPress={isBlocked ? () => Linking.openSettings() : onRetry}
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
        style={[styles.button, { backgroundColor: theme.backgroundSelected }]}
      >
        <ThemedText type="smallBold">{buttonLabel}</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.two },
  button: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
});
