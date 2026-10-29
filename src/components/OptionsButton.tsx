// Botón del engranaje que va a la derecha de las cabeceras: abre la pantalla Opciones.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function OptionsButton() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('options.open')}
      onPress={() => router.push('/opciones')}
      style={{ padding: 12 }}>
      <MaterialCommunityIcons name="cog-outline" size={24} color={theme.text} />
    </Pressable>
  );
}
