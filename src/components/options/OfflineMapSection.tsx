// Bloque "Mapa sin conexión" de Opciones: descargar el mapa de Jerez al móvil, ver el progreso,
// borrarlo y reintentar si la descarga falla. Si no se descarga, el mapa sigue funcionando con la red.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { OFFLINE_MAP_APPROX_MB, deleteOfflineMap, downloadOfflineMap, useOfflineMap } from '@/lib/offlineMap';

// Fase de la descarga que se está haciendo desde esta pantalla.
type Phase = { kind: 'idle' } | { kind: 'downloading'; done: number; total: number } | { kind: 'error' };

export function OfflineMapSection() {
  const { t } = useTranslation();
  const status = useOfflineMap((s) => s.status);
  const refresh = useOfflineMap((s) => s.refresh);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  // Al abrir Opciones miramos qué hay realmente en el disco.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Lanza la descarga y apunta el progreso; si falla, pasa al estado de error.
  async function start() {
    setPhase({ kind: 'downloading', done: 0, total: 0 });
    try {
      await downloadOfflineMap((done, total) => setPhase({ kind: 'downloading', done, total }));
      setPhase({ kind: 'idle' });
    } catch {
      setPhase({ kind: 'error' });
    }
  }

  if (phase.kind === 'downloading') {
    return <ThemedText>{t('options.mapDownloading', { done: phase.done, total: phase.total })}</ThemedText>;
  }
  if (phase.kind === 'error') {
    return (
      <View style={styles.row}>
        <ThemedText>{t('options.mapError')}</ThemedText>
        <Button label={t('options.mapRetry')} onPress={start} />
      </View>
    );
  }
  if (status.downloaded) {
    return (
      <View style={styles.row}>
        <ThemedText>{t('options.mapDownloaded', { mb: Math.max(1, Math.round(status.bytes / 1e6)) })}</ThemedText>
        <Button label={t('options.mapDelete')} onPress={() => void deleteOfflineMap()} />
      </View>
    );
  }
  return <Button label={t('options.mapDownload', { mb: OFFLINE_MAP_APPROX_MB })} onPress={start} />;
}

// Botón sencillo de texto, con zona de toque de 44 px.
function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.button}>
      <ThemedText type="linkPrimary">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  button: { minHeight: 44, justifyContent: 'center' },
});
