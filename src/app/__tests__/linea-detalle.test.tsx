// Prueba del detalle de una línea: sentidos, paradas en orden, abrir Horarios y línea inexistente.
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { DataProvider } from '@/data/DataProvider';
import type { Dataset, Line } from '@/data/schema';
import { initI18n } from '@/i18n';
import { openSchedule } from '@/lib/navigation';

import Linea from '../(tabs)/lineas/[id]';

const mockBack = jest.fn();
const mockRouter = { push: jest.fn(), back: mockBack, canGoBack: () => true };
let mockParams: { id: string } = { id: '1' };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/lib/navigation', () => ({ openSchedule: jest.fn() }));

function makeLine(id: string, directions: { headsign: string; stopCodes: string[] }[]): Line {
  return {
    id,
    name: `Nombre ${id}`,
    colour: '#FFDE4D',
    stopCodes: directions[0].stopCodes,
    directions,
    shapes: [],
    timesByStop: {},
    trips: { lab: [], sab: [], fes: [] },
  };
}

const data: Dataset = {
  schemaVersion: 1,
  generatedAt: '2026-10-28T00:00:00Z',
  holidays: [],
  stops: {
    A: { code: 'A', name: 'Parada Uno', description: '', lat: 0, lon: 0, coordSource: 'kml' },
    B: { code: 'B', name: 'Parada Dos', description: '', lat: 0, lon: 0, coordSource: 'name-match', approximate: true },
    C: { code: 'C', name: 'Parada Tres', description: '', lat: 0, lon: 0, coordSource: 'kml' },
  },
  lines: [
    makeLine('1', [
      { headsign: 'Norte', stopCodes: ['A', 'B', 'C'] },
      { headsign: 'Sur', stopCodes: ['C', 'B', 'A'] },
    ]),
    makeLine('8', [{ headsign: 'Circular', stopCodes: ['A', 'C'] }]),
  ],
};

// Línea con 80 paradas y un recorrido, para comprobar que el mapa usa una sola fuente de paradas.
const manyCodes = Array.from({ length: 80 }, (_, i) => `P${i}`);
const manyData: Dataset = {
  ...data,
  stops: {
    ...data.stops,
    ...Object.fromEntries(
      manyCodes.map((code, i) => [
        code,
        { code, name: `Parada ${i}`, description: '', lat: 36.68 + i * 0.001, lon: -6.13, coordSource: 'kml' as const },
      ]),
    ),
  },
  lines: [
    {
      ...makeLine('80', [{ headsign: 'Largo', stopCodes: manyCodes }]),
      shapes: [[[-6.13, 36.68], [-6.12, 36.76]]],
    },
  ],
};

// Ayudas que solo existen en el mock de MapLibre (carpeta __mocks__ de la raíz).
const { failMapLoading, breakMapRendering, getRecorded, resetMock } = jest.requireMock('@maplibre/maplibre-react-native');

function renderScreen(dataset: Dataset = data) {
  return render(
    <DataProvider value={{ data: dataset, source: 'bundled', checkedAt: null }}>
      <Linea />
    </DataProvider>,
  );
}

beforeAll(() => {
  initI18n('es');
});
beforeEach(() => {
  jest.clearAllMocks();
  resetMock();
  mockParams = { id: '1' };
});

describe('detalle de línea', () => {
  it('con 2 sentidos muestra dos títulos "Hacia" y las paradas numeradas en orden', async () => {
    await renderScreen();
    expect(screen.getByText('Hacia Norte')).toBeTruthy();
    expect(screen.getByText('Hacia Sur')).toBeTruthy();
    expect(screen.queryByText('Recorrido')).toBeNull();
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel);
    expect(labels).toEqual([
      '1. Parada Uno', '2. Parada Dos, ubicación aproximada', '3. Parada Tres',
      '1. Parada Tres', '2. Parada Dos, ubicación aproximada', '3. Parada Uno',
    ]);
    expect(screen.getAllByText('ubicación aproximada')).toHaveLength(2);
  });

  it('con 1 sentido el bloque se titula "Recorrido"', async () => {
    mockParams = { id: '8' };
    await renderScreen();
    expect(screen.getByText('Recorrido')).toBeTruthy();
    expect(screen.queryByText(/^Hacia/)).toBeNull();
  });

  it('al pulsar una parada abre Horarios con esa línea y parada', async () => {
    await renderScreen();
    await fireEvent.press(screen.getAllByLabelText(/Parada Dos/)[0]);
    expect(openSchedule).toHaveBeenCalledWith(mockRouter, '1', 'B');
  });

  it('con un id desconocido avisa y deja volver', async () => {
    mockParams = { id: '99' };
    await renderScreen();
    expect(screen.getByText('Línea no encontrada')).toBeTruthy();
    await fireEvent.press(screen.getByText('Volver'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('renders one ShapeSource for stops y una para el recorrido', async () => {
    mockParams = { id: '80' };
    await renderScreen(manyData);
    expect(screen.getAllByTestId('shape-source-stops')).toHaveLength(1);
    expect(screen.getAllByTestId('shape-source-shapes')).toHaveLength(1);
    // La caja del mapa abarca las paradas y el recorrido.
    expect(getRecorded().camera?.initialViewState).toMatchObject({ bounds: [-6.13, 36.68, -6.12, 36.76] });
  });

  it('al pulsar una parada del mapa abre Horarios con esa línea y parada', async () => {
    mockParams = { id: '80' };
    await renderScreen(manyData);
    await fireEvent.press(screen.getByTestId('press-stops-P7'));
    expect(openSchedule).toHaveBeenCalledWith(mockRouter, '80', 'P7');
  });

  it('si el mapa falla, sigue con fondo liso y aviso, y la lista sigue', async () => {
    await renderScreen();
    await act(async () => failMapLoading());
    expect(screen.getByText('Mapa no disponible ahora mismo')).toBeTruthy();
    expect(screen.getByTestId('map-view')).toBeTruthy();
    expect(screen.getByText('○ ubicación aproximada')).toBeTruthy();
    expect(screen.getByText('Hacia Norte')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(7); // 6 de la pantalla + Reintentar del mapa
  });

  it('sin motor de mapas (solo el recuadro de texto) no sale la leyenda', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    breakMapRendering();
    await renderScreen();
    expect(screen.getByText('Mapa no disponible ahora mismo')).toBeTruthy();
    expect(screen.queryByText('○ ubicación aproximada')).toBeNull();
    jest.restoreAllMocks();
  });

  it('con una parada aproximada muestra la leyenda bajo el mapa', async () => {
    await renderScreen();
    expect(screen.getByText('○ ubicación aproximada')).toBeTruthy();
  });

  it('sin paradas aproximadas no muestra la leyenda', async () => {
    mockParams = { id: '80' };
    await renderScreen(manyData);
    expect(screen.queryByText('○ ubicación aproximada')).toBeNull();
  });
});
