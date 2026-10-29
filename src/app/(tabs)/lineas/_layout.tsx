// Pila de pantallas de la pestaña Líneas: la lista y, encima, el detalle de una línea.
// Va dentro de la pestaña (no en la raíz de la app) para que abrir Horarios desde el detalle
// sea un simple cambio de pestaña y no apile una segunda barra de pestañas.
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { OptionsButton } from '@/components/OptionsButton';

// Si se entra directamente a una línea (enlace), debajo queda la lista.
export const unstable_settings = { initialRouteName: 'index' };

export default function LineasLayout() {
  const { t } = useTranslation();
  return (
    <Stack>
      {/* La cabecera de la pestaña está oculta: la lista pone la suya, con el engranaje. */}
      <Stack.Screen name="index" options={{ title: t('tabs.lines'), headerRight: () => <OptionsButton /> }} />
      {/* El detalle lleva el título "Línea N" y el botón de volver que añade la pila. */}
      <Stack.Screen
        name="[id]"
        options={({ route }) => ({
          title: t('schedule.lineLabel', { id: (route.params as { id?: string } | undefined)?.id ?? '' }),
        })}
      />
    </Stack>
  );
}
