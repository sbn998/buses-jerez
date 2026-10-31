// Barra de 5 pestañas de la app, en este orden:
// Cerca de mí · Horarios · Cómo llego · Líneas · Recarga.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppNoticeBanner } from '@/components/NoticeBanner';
import { OptionsButton } from '@/components/OptionsButton';

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
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        // Engranaje a la derecha de la cabecera de cada pestaña: abre Opciones.
        headerRight: () => <OptionsButton />,
      }}
      // Los avisos (horario caducado, cambio próximo…) salen arriba de cada pestaña, bajo la cabecera.
      // Líneas no tiene cabecera aquí (lleva la suya dentro), así que allí no se pone para no tapar la barra de estado.
      screenLayout={({ children, options }) => (
        <View style={{ flex: 1 }}>
          {options.headerShown === false ? null : <AppNoticeBanner />}
          {children}
        </View>
      )}>
      {PESTANAS.map((p) => (
        <Tabs.Screen
          key={p.name}
          name={p.name}
          options={{
            title: t(p.titleKey),
            // Líneas tiene su propia pila con cabecera: así no sale una doble cabecera.
            ...(p.name === 'lineas' ? { headerShown: false } : {}),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name={p.icon} color={color as string} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
