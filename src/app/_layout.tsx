// Layout raíz de la app: inicia los idiomas, aplica el tema claro/oscuro y carga el grupo de pestañas.
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { getLocales } from 'expo-localization';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DataProvider } from '@/data/DataProvider';
import i18n, { initI18n, resolveLanguage } from '@/i18n';
import { useSettings } from '@/stores/settings';

export default function RootLayout() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const language = useSettings((s) => s.language);
  // Idioma final según el ajuste elegido y el idioma del móvil.
  const lang = resolveLanguage(language, getLocales()[0]?.languageCode ?? null);
  // Primera vez: se inicia ya en el render para que la primera pantalla tenga textos.
  if (!i18n.isInitialized) initI18n(lang);
  // Después, los cambios de idioma se hacen en un efecto (nunca durante el render).
  useEffect(() => {
    initI18n(lang);
  }, [lang]);
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <DataProvider>
        <ErrorBoundary>
          <Stack screenOptions={{ headerShown: false }}>
            {/* Opciones lleva cabecera propia (con botón de volver). El detalle de línea vive dentro de la pestaña Líneas. */}
            <Stack.Screen name="opciones" options={{ headerShown: true, title: t('options.title') }} />
          </Stack>
        </ErrorBoundary>
      </DataProvider>
    </ThemeProvider>
  );
}
