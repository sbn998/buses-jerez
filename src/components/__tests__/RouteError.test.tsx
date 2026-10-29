// Prueba de la pantalla de error por pestaña: muestra el aviso, "Reintentar" llama a retry,
// y cada pantalla de la app exporta su propio ErrorBoundary (la barra de pestañas se queda visible).
import { fireEvent, render, screen } from '@testing-library/react-native';

import { RouteError } from '@/components/RouteError';
import { initI18n } from '@/i18n';

// Las pantallas usan expo-router y la ubicación; se simulan igual que en sus propias pruebas.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/hooks/use-location', () => ({
  useLocation: () => ({ status: 'ready', coords: { lat: 0, lon: 0 }, retry: jest.fn() }),
}));
jest.mock('@/hooks/use-now', () => ({ useNow: () => new Date(2026, 9, 28, 10, 0, 0) }));

beforeAll(() => {
  initI18n('es');
});

describe('RouteError', () => {
  it('muestra el aviso de la pantalla y, al pulsar Reintentar, llama a retry', async () => {
    // React escribe el error en consola; se silencia para dejar la salida limpia.
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const retry = jest.fn();
    await render(<RouteError error={new Error('boom')} retry={retry} />);
    expect(screen.getByText('Algo ha fallado en esta pantalla')).toBeTruthy();
    await fireEvent.press(screen.getByText('Reintentar'));
    expect(retry).toHaveBeenCalledTimes(1);
    jest.restoreAllMocks();
  });
});

// Cada pantalla de la app debe tener su propio ErrorBoundary. Se importa el módulo y se comprueba.
describe('pantallas con ErrorBoundary propio', () => {
  it.each([
    ['cerca', () => require('@/app/(tabs)/cerca')],
    ['horarios', () => require('@/app/(tabs)/horarios')],
    ['como-llego', () => require('@/app/(tabs)/como-llego')],
    ['recarga', () => require('@/app/(tabs)/recarga')],
    ['lineas/index', () => require('@/app/(tabs)/lineas/index')],
    ['lineas/[id]', () => require('@/app/(tabs)/lineas/[id]')],
    ['opciones', () => require('@/app/opciones')],
  ])('la pantalla %s exporta ErrorBoundary', (_nombre, cargar) => {
    const mod = cargar();
    expect(typeof mod.ErrorBoundary).toBe('function');
  });
});
