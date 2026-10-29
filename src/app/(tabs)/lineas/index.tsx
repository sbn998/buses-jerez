// Pestaña "Líneas": lista de todas las líneas en orden numérico. Al tocar una se abre su detalle.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LineRow } from '@/components/lines/LineRow';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useTheme } from '@/hooks/use-theme';

export default function Lineas() {
  const router = useRouter();
  const theme = useTheme();
  const { data } = useData();
  // Orden numérico real (1, 2, ... 10), no alfabético (1, 10, 11, ... 2).
  const lines = useMemo(() => [...data.lines].sort((a, b) => Number(a.id) - Number(b.id)), [data]);

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.background }]}>
      <FlatList
        data={lines}
        keyExtractor={(line) => line.id}
        initialNumToRender={lines.length}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => <LineRow line={item} onPress={() => router.push(`/(tabs)/lineas/${item.id}`)} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three, paddingBottom: BottomTabInset + Spacing.four, gap: Spacing.two },
});

// Si esta pantalla falla, se muestra su propio aviso y la barra de pestañas sigue visible.
export { RouteError as ErrorBoundary } from '@/components/RouteError';
