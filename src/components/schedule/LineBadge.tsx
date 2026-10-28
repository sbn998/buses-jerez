// Etiqueta con el número de una línea sobre su color oficial (texto oscuro o claro según contraste).
import { StyleSheet, Text, View } from 'react-native';

import type { Line } from '@/data/schema';
import { textColourFor } from '@/lib/colour';

export function LineBadge({ line }: { line: Pick<Line, 'id' | 'colour'> }) {
  return (
    <View style={[styles.badge, { backgroundColor: line.colour }]}>
      <Text style={[styles.text, { color: textColourFor(line.colour) }]}>{line.id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { minWidth: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  text: { fontSize: 18, fontWeight: '700' },
});
