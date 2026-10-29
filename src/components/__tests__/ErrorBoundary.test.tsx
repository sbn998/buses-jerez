// Prueba del ErrorBoundary: si un hijo falla se ve el aviso, y "Reintentar" vuelve a pintar los hijos.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { initI18n } from '@/i18n';

// Mientras sea true, el hijo lanza un error al pintarse.
let fallar = true;
function Hijo() {
  if (fallar) throw new Error('boom');
  return <Text>Contenido sano</Text>;
}

beforeAll(() => {
  initI18n('es');
});

describe('ErrorBoundary', () => {
  it('muestra el aviso y, tras Reintentar, vuelve a pintar el hijo', async () => {
    // React escribe el error en consola; se silencia para dejar la salida limpia.
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    fallar = true;
    await render(
      <ErrorBoundary>
        <Hijo />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Algo ha fallado')).toBeTruthy();
    fallar = false;
    await fireEvent.press(screen.getByText('Reintentar'));
    expect(screen.getByText('Contenido sano')).toBeTruthy();
    jest.restoreAllMocks();
  });
});
