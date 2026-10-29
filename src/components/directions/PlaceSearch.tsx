// Buscador de lugares de Cómo llego: un campo de texto, el botón Buscar, la lista de lugares encontrados
// y los avisos de error. Solo busca al pulsar Buscar o Intro (nunca letra a letra) y con 3 letras como mínimo.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type Place, SearchError, searchPlaces } from '@/lib/placeSearch';

interface Props {
  placeholder: string;
  onPick: (place: Place) => void;
  /** Función que busca (se puede cambiar en las pruebas). */
  search?: typeof searchPlaces;
  /** Se avisa a la pantalla cuando la búsqueda falla por falta de conexión. */
  onOffline?: () => void;
}

const MIN_LETTERS = 3;

export function PlaceSearch({ placeholder, onPick, search = searchPlaces, onOffline }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<'tooShort' | 'busy' | 'failed' | null>(null);
  // Para no tocar el estado si la pantalla ya ha quitado este componente mientras se buscaba.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Lanza la búsqueda: comprueba las letras, pide los lugares y guarda la lista o el error.
  async function submit() {
    const text = query.trim();
    setResults(null);
    if (text.length < MIN_LETTERS) {
      setError('tooShort');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const places = await search(text);
      if (mounted.current) setResults(places);
    } catch (e) {
      const kind = e instanceof SearchError ? e.kind : 'failed';
      if (kind === 'offline') {
        onOffline?.();
      } else if (mounted.current) {
        setError(kind);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={t('directions.searchLabel')}
          returnKeyType="search"
          onSubmitEditing={submit}
          autoCorrect={false}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
        <Pressable
          onPress={submit}
          accessibilityRole="button"
          accessibilityLabel={t('directions.search')}
          style={[styles.button, { backgroundColor: theme.backgroundSelected }]}
        >
          <ThemedText type="smallBold">{t('directions.search')}</ThemedText>
        </Pressable>
      </View>

      {loading ? <ThemedText themeColor="textSecondary">{t('directions.searching')}</ThemedText> : null}
      {error === 'tooShort' ? <ThemedText themeColor="textSecondary">{t('directions.tooShort')}</ThemedText> : null}
      {error === 'busy' ? <ThemedText>{t('directions.busy')}</ThemedText> : null}
      {error === 'failed' ? (
        <View style={styles.row}>
          <ThemedText>{t('directions.failed')}</ThemedText>
          <Pressable
            onPress={submit}
            accessibilityRole="button"
            accessibilityLabel={t('directions.retrySearch')}
            style={[styles.button, { backgroundColor: theme.backgroundSelected }]}
          >
            <ThemedText type="smallBold">{t('directions.retrySearch')}</ThemedText>
          </Pressable>
        </View>
      ) : null}
      {results && results.length === 0 ? <ThemedText>{t('directions.noResults')}</ThemedText> : null}

      {results?.map((place) => (
        <Pressable
          key={`${place.id}|${place.name}|${place.detail}`}
          onPress={() => {
            setResults(null);
            setQuery('');
            onPick(place);
          }}
          accessibilityRole="button"
          accessibilityLabel={place.detail ? `${place.name}, ${place.detail}` : place.name}
          style={[styles.place, { backgroundColor: theme.backgroundElement }]}
        >
          <ThemedText type="smallBold">{place.name}</ThemedText>
          {place.detail ? (
            <ThemedText type="small" themeColor="textSecondary">
              {place.detail}
            </ThemedText>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: { flex: 1, minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: Spacing.three, fontSize: 16 },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  place: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
});
