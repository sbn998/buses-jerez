// Layout raíz de la app: inicia los idiomas, aplica el tema claro/oscuro y carga el grupo de pestañas.
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { getLocales } from 'expo-localization';
import { useColorScheme } from 'react-native';

import { initI18n, resolveLanguage } from '@/i18n';
import { useSettings } from '@/stores/settings';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const language = useSettings((s) => s.language);
  // Idioma final según el ajuste elegido y el idioma del móvil.
  // Se inicia en el render para que las pantallas ya tengan textos al pintarse.
  initI18n(resolveLanguage(language, getLocales()[0]?.languageCode ?? null));
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
