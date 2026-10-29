// Pestaña "Cómo llego": comprueba la conexión, elige el origen (tu ubicación o un lugar escrito)
// y busca el destino. Los resultados del planificador se pintan más adelante (Task 5).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfflineNotice } from '@/components/directions/OfflineNotice';
import { PlaceSearch } from '@/components/directions/PlaceSearch';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useLocation } from '@/hooks/use-location';
import { useTheme } from '@/hooks/use-theme';
import { isOnline } from '@/lib/online';
import type { Place } from '@/lib/placeSearch';

type Connection = 'checking' | 'online' | 'offline';
type Origin = { kind: 'me' } | { kind: 'place'; place: Place };

// Estados de ubicación en los que no hay posición y hay que pedir el origen escrito.
const NO_POSITION = ['denied', 'blocked', 'unavailable', 'nosignal'];

export default function ComoLlego() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { status } = useLocation();
  const [connection, setConnection] = useState<Connection>('checking');
  const [origin, setOrigin] = useState<Origin>({ kind: 'me' });
  const [destination, setDestination] = useState<Place | null>(null);
  // true mientras el usuario está eligiendo otro origen con el botón "Cambiar".
  const [changingOrigin, setChangingOrigin] = useState(false);
  // Número de la última comprobación: si llega una respuesta vieja, se ignora.
  const checkId = useRef(0);

  // Comprueba si hay internet de verdad y guarda el resultado.
  const check = useCallback(async () => {
    const id = ++checkId.current;
    setConnection('checking');
    const online = await isOnline();
    if (id === checkId.current) setConnection(online ? 'online' : 'offline');
  }, []);

  // Se comprueba al abrir la pantalla y cada vez que la app vuelve a primer plano.
  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      sub.remove();
      checkId.current++; // al salir, se descartan las respuestas pendientes
    };
  }, [check]);

  // Una búsqueda sin red pasa la pantalla a "sin conexión".
  const goOffline = useCallback(() => {
    checkId.current++;
    setConnection('offline');
  }, []);

  if (connection === 'offline') {
    return (
      <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.background }]}>
        <OfflineNotice onRetry={check} />
      </SafeAreaView>
    );
  }

  const needsOrigin = origin.kind === 'me' && NO_POSITION.includes(status);
  const pickingOrigin = needsOrigin || changingOrigin;

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="subtitle">{t('directions.title')}</ThemedText>
        <ThemedText themeColor="textSecondary">{t('directions.subtitle')}</ThemedText>

        {connection === 'checking' ? (
          <ThemedText themeColor="textSecondary">{t('directions.checking')}</ThemedText>
        ) : (
          <>
            {needsOrigin ? <ThemedText type="smallBold">{t('directions.chooseOrigin')}</ThemedText> : (
              <View style={styles.row}>
                <ThemedText style={styles.grow}>
                  {origin.kind === 'me'
                    ? t('directions.fromMe')
                    : t('directions.fromPlace', { name: origin.place.name })}
                </ThemedText>
                <Pressable
                  onPress={() => setChangingOrigin((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={t('directions.changeOrigin')}
                  style={[styles.button, { backgroundColor: theme.backgroundSelected }]}
                >
                  <ThemedText type="smallBold">{t('directions.change')}</ThemedText>
                </Pressable>
              </View>
            )}

            {pickingOrigin ? (
              <>
                <PlaceSearch
                  placeholder={t('directions.originPlaceholder')}
                  onPick={(place) => {
                    setOrigin({ kind: 'place', place });
                    setChangingOrigin(false);
                  }}
                  onOffline={goOffline}
                />
                {changingOrigin && !needsOrigin ? (
                  <Pressable
                    onPress={() => {
                      setOrigin({ kind: 'me' });
                      setChangingOrigin(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('directions.useMyLocation')}
                    style={[styles.button, styles.start, { backgroundColor: theme.backgroundSelected }]}
                  >
                    <ThemedText type="smallBold">{t('directions.useMyLocation')}</ThemedText>
                  </Pressable>
                ) : null}
              </>
            ) : destination ? (
              <View style={styles.row}>
                <ThemedText style={styles.grow}>{t('directions.to', { name: destination.name })}</ThemedText>
                <Pressable
                  onPress={() => setDestination(null)}
                  accessibilityRole="button"
                  accessibilityLabel={t('directions.changeDestination')}
                  style={[styles.button, { backgroundColor: theme.backgroundSelected }]}
                >
                  <ThemedText type="smallBold">{t('directions.change')}</ThemedText>
                </Pressable>
              </View>
            ) : (
              <PlaceSearch
                placeholder={t('directions.destinationPlaceholder')}
                onPick={setDestination}
                onOffline={goOffline}
              />
            )}
            {/* Aquí irán las opciones de bus cuando haya origen y destino (Task 5). */}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three, paddingBottom: BottomTabInset + Spacing.four, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  grow: { flex: 1 },
  start: { alignSelf: 'flex-start' },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
});

// Si esta pantalla falla, se muestra su propio aviso y la barra de pestañas sigue visible.
export { RouteError as ErrorBoundary } from '@/components/RouteError';
