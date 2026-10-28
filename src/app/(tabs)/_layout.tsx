// Barra de 5 pestañas de la app, en este orden:
// Cerca de mí · Horarios · Cómo llego · Líneas · Recarga.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// Cada pestaña: nombre del archivo, título visible e icono. La primera (cerca) es la inicial.
const PESTANAS: { name: string; title: string; icon: IconName }[] = [
  { name: 'cerca', title: 'Cerca de mí', icon: 'map-marker-radius' },
  { name: 'horarios', title: 'Horarios', icon: 'clock-outline' },
  { name: 'como-llego', title: 'Cómo llego', icon: 'directions' },
  { name: 'lineas', title: 'Líneas', icon: 'bus-multiple' },
  { name: 'recarga', title: 'Recarga', icon: 'credit-card-outline' },
];

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      {PESTANAS.map((p) => (
        <Tabs.Screen
          key={p.name}
          name={p.name}
          options={{
            title: p.title,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name={p.icon} color={color as string} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
