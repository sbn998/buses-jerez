// Red de seguridad de la app: si una pantalla falla al pintarse, en vez de cerrarse la app
// se muestra "Algo ha fallado" con un botón para reintentar.
import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import i18n from '@/i18n';

type Props = { children: ReactNode };
type State = { hasError: boolean };

// Solo las clases pueden "cazar" errores de pintado en React; por eso no es una función.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  // React llama a esto cuando un hijo lanza un error: marcamos que hay error.
  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  // Solo en desarrollo, deja el error en la consola para poder investigarlo.
  componentDidCatch(error: Error) {
    if (__DEV__) console.warn('ErrorBoundary:', error);
  }

  // Quita el error: los hijos se vuelven a pintar.
  private retry = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">{i18n.t('error.title')}</ThemedText>
        <Pressable accessibilityRole="button" onPress={this.retry} style={styles.button}>
          <ThemedText type="link">{i18n.t('error.retry')}</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  button: { paddingVertical: 12, paddingHorizontal: 24, minHeight: 44, justifyContent: 'center' },
});
