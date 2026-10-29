// Prueba del detalle de una línea: sentidos, paradas en orden, abrir Horarios y línea inexistente.
import { fireEvent, render, screen } from '@testing-library/react-native';

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

function renderScreen() {
  return render(
    <DataProvider value={{ data, source: 'bundled', checkedAt: null }}>
      <Linea />
    </DataProvider>,
  );
}

beforeAll(() => {
  initI18n('es');
});
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: '1' };
});

describe('detalle de línea', () => {
  it('con 2 sentidos muestra dos títulos "Hacia" y las paradas numeradas en orden', async () => {
    await renderScreen();
    expect(screen.getByText('Hacia Norte')).toBeTruthy();
    expect(screen.getByText('Hacia Sur')).toBeTruthy();
    expect(screen.queryByText('Recorrido')).toBeNull();
    expect(screen.getByText('El mapa llegará pronto')).toBeTruthy();
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
});
