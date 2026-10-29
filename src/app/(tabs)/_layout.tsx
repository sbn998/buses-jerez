// Barra de 5 pestañas de la app, en este orden:
// Cerca de mí · Horarios · Cómo llego · Líneas · Recarga.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// Cada pestaña: nombre del archivo, clave del título (i18n) e icono. La primera (cerca) es la inicial.
const PESTANAS: { name: string; titleKey: string; icon: IconName }[] = [
  { name: 'cerca', titleKey: 'tabs.nearby', icon: 'map-marker-radius' },
  { name: 'horarios', titleKey: 'tabs.schedules', icon: 'clock-outline' },
  { name: 'como-llego', titleKey: 'tabs.directions', icon: 'directions' },
  { name: 'lineas', titleKey: 'tabs.lines', icon: 'bus-multiple' },
  { name: 'recarga', titleKey: 'tabs.topup', icon: 'credit-card-outline' },
];

export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        // Engranaje a la derecha de la cabecera de cada pestaña: abre Opciones.
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('options.open')}
            onPress={() => router.push('/opciones')}
            style={{ padding: 12 }}>
            <MaterialCommunityIcons name="cog-outline" size={24} color={theme.text} />
          </Pressable>
        ),
      }}>
      {PESTANAS.map((p) => (
        <Tabs.Screen
          key={p.name}
          name={p.name}
          options={{
            title: t(p.titleKey),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name={p.icon} color={color as string} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
