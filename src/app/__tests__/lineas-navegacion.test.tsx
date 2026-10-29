// Prueba de navegación real (expo-router): lista de líneas → detalle → Horarios.
// Comprueba que ir a Horarios desde el detalle es un cambio de pestaña y no apila
// una segunda barra de pestañas encima (el fallo que tenía el detalle en la pila raíz).
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router, Stack } from 'expo-router';
import { act } from '@testing-library/react-native';

import { DataProvider } from '@/data/DataProvider';
import type { Dataset, Line } from '@/data/schema';
import { initI18n } from '@/i18n';
import { openSchedule } from '@/lib/navigation';

import TabsLayout from '../(tabs)/_layout';
import Cerca from '../(tabs)/cerca';
import Horarios from '../(tabs)/horarios';
import ComoLlego from '../(tabs)/como-llego';
import Recarga from '../(tabs)/recarga';
import LineasLayout from '../(tabs)/lineas/_layout';
import Lineas from '../(tabs)/lineas/index';
import LineaDetalle from '../(tabs)/lineas/[id]';

// Los iconos usan una fuente que Jest no tiene: se cambian por un componente vacío.
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('@/hooks/use-location', () => ({
  useLocation: () => ({ status: 'waiting', coords: null, accuracy: null, coarse: false, retry: jest.fn() }),
}));

const line: Line = {
  id: '1',
  name: 'Esteve - San Telmo',
  colour: '#FFDE4D',
  stopCodes: ['A'],
  directions: [{ headsign: 'San Telmo', stopCodes: ['A'] }],
  shapes: [],
  timesByStop: { A: { lab: ['10:30'], sab: [], fes: [] } },
  trips: { lab: [], sab: [], fes: [] },
};
const data: Dataset = {
  schemaVersion: 1,
  generatedAt: '2026-10-28T00:00:00Z',
  holidays: [],
  stops: { A: { code: 'A', name: 'Plaza Esteve', description: '', lat: 0, lon: 0, coordSource: 'kml' } },
  lines: [line],
};

// Misma estructura que la app real: raíz con datos → pestañas → pila dentro de Líneas.
function renderApp(initialUrl: string) {
  return renderRouter(
    {
      _layout: () => (
        <DataProvider value={{ data, source: 'bundled', checkedAt: null }}>
          <Stack screenOptions={{ headerShown: false }} />
        </DataProvider>
      ),
      '(tabs)/_layout': TabsLayout,
      '(tabs)/cerca': Cerca,
      '(tabs)/horarios': Horarios,
      '(tabs)/como-llego': ComoLlego,
      '(tabs)/recarga': Recarga,
      '(tabs)/lineas/_layout': LineasLayout,
      '(tabs)/lineas/index': Lineas,
      '(tabs)/lineas/[id]': LineaDetalle,
    },
    { initialUrl },
  );
}

// Pantallas de la pila raíz de la app (dentro del contenedor interno "__root" de expo-router).
function rootRoutes(view: { getRouterState(): { routes: { state?: { routes: { name: string }[] } }[] } | undefined }) {
  return view.getRouterState()?.routes[0]?.state?.routes ?? [];
}

beforeAll(() => {
  initI18n('es');
});

describe('navegación de Líneas', () => {
  it('lista → detalle → parada: Horarios se abre como cambio de pestaña, sin segunda barra de pestañas', async () => {
    const view = await renderApp('/lineas');
    await fireEvent.press(screen.getByLabelText('Línea 1'));
    expect(view.getPathname()).toBe('/lineas/1');

    await fireEvent.press(screen.getByLabelText('1. Plaza Esteve'));
    // (el botón de la parada llama a openSchedule con el router real)
    expect(view.getPathname()).toBe('/horarios');
    expect(view.getSearchParams()).toMatchObject({ line: '1', stop: 'A' });

    // La pila raíz sigue teniendo una sola pantalla: el grupo (tabs) no se ha duplicado.
    expect(rootRoutes(view)).toHaveLength(1);
    expect(rootRoutes(view)[0].name).toBe('(tabs)');
  });

  it('abrir Horarios varias veces no hace crecer la pila raíz', async () => {
    const view = await renderApp('/lineas/1');
    for (let i = 0; i < 3; i++) {
      await act(async () => openSchedule(router, '1', 'A'));
    }
    expect(rootRoutes(view)).toHaveLength(1);
  });
});
