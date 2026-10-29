// Prueba de la pantalla Cerca de mí con datos pequeños, posición y reloj simulados.
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DataProvider } from '@/data/DataProvider';
import type { Dataset, Line } from '@/data/schema';
import { initI18n } from '@/i18n';
import { useFavorites } from '@/stores/favorites';

import Cerca from '../(tabs)/cerca';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

let mockLocation: any = { status: 'ready', coords: { lat: 0, lon: 0 }, retry: jest.fn() };
jest.mock('@/hooks/use-location', () => ({ useLocation: () => mockLocation }));

// Miércoles 28 de octubre de 2026, 10:00 (día laborable).
jest.mock('@/hooks/use-now', () => ({ useNow: () => new Date(2026, 9, 28, 10, 0, 0) }));

function makeLine(id: string, stopCodes: string[], lab: string[], oneDirection = false): Line {
  const times = Object.fromEntries(stopCodes.map((c) => [c, { lab, sab: [], fes: [] }]));
  return {
    id,
    name: `Línea ${id}`,
    colour: '#FFDE4D',
    stopCodes,
    // Con dos sentidos se enseña "hacia …"; con uno solo no.
    directions: oneDirection
      ? [{ headsign: `Destino ${id}`, stopCodes }]
      : [
          { headsign: `Destino ${id}`, stopCodes },
          { headsign: `Vuelta ${id}`, stopCodes: [] },
        ],
    shapes: [],
    timesByStop: times,
    trips: { lab: [], sab: [], fes: [] },
  };
}

const data: Dataset = {
  schemaVersion: 1,
  generatedAt: '2026-10-28T00:00:00Z',
  holidays: [],
  stops: {
    // ~111 m al norte del punto (0, 0) y ~334 m.
    A: { code: 'A', name: 'Plaza Cercana', description: '', lat: 0.001, lon: 0, coordSource: 'kml' },
    B: { code: 'B', name: 'Calle Lejana', description: '', lat: 0.003, lon: 0, coordSource: 'name-match', approximate: true },
  },
  lines: [
    makeLine('1', ['A'], ['10:30']),
    makeLine('2', ['A'], []), // sin horas hoy: "Sin servicio hoy"
    makeLine('3', ['B'], ['09:00']), // tiene horas pero ya pasaron
    makeLine('4', ['A'], ['11:00'], true), // un solo sentido: sin "hacia …"
  ],
};

function renderScreen() {
  return render(
    <DataProvider value={{ data, source: 'bundled', checkedAt: null }}>
      <Cerca />
    </DataProvider>,
  );
}

beforeAll(() => {
  initI18n('es');
});
beforeEach(() => {
  mockPush.mockClear();
  useFavorites.setState({ items: [] });
  mockLocation = { status: 'ready', coords: { lat: 0, lon: 0 }, retry: jest.fn() };
});

describe('pantalla Cerca de mí', () => {
  it('muestra la parada más cercana abierta con destino, hora y distancia; al pulsar la línea abre Horarios', async () => {
    await renderScreen();
    expect(screen.getByText('Plaza Cercana')).toBeTruthy();
    expect(screen.getByText('111 m · 2 min')).toBeTruthy();
    expect(screen.getByText('hacia Destino 1')).toBeTruthy();
    expect(screen.getByText('10:30 · en 30 min')).toBeTruthy();
    expect(screen.getByText('El mapa llegará pronto')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Abrir Línea 1 en Plaza Cercana'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    const arg = mockPush.mock.calls[0][0];
    expect(arg.params.line).toBe('1');
    expect(arg.params.stop).toBe('A');
    expect(typeof arg.params.nonce).toBe('string');
  });

  it('una línea de un solo sentido no escribe "hacia …"', async () => {
    await renderScreen();
    expect(screen.getByText('11:00 · en 60 min')).toBeTruthy();
    expect(screen.queryByText('hacia Destino 4')).toBeNull();
  });

  it('una línea sin horas hoy sigue visible y dice "Sin servicio hoy"', async () => {
    await renderScreen();
    expect(screen.getByText('hacia Destino 2')).toBeTruthy();
    expect(screen.getByText('Sin servicio hoy')).toBeTruthy();
  });

  it('las demás paradas salen plegadas y se abren al tocarlas; si ya pasaron todas las horas, lo dice', async () => {
    await renderScreen();
    expect(screen.queryByText('hacia Destino 3')).toBeNull();
    expect(screen.getByText('334 m · 5 min · ubicación aproximada')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Calle Lejana'));
    expect(screen.getByText('hacia Destino 3')).toBeTruthy();
    expect(screen.getByText('No quedan buses hoy')).toBeTruthy();
  });

  it('si no hay paradas a menos de 500 m, avisa de que son las más cercanas', async () => {
    mockLocation = { status: 'ready', coords: { lat: 0.1, lon: 0 }, retry: jest.fn() };
    await renderScreen();
    expect(screen.getByText('No hay paradas a menos de 500 m. Estas son las más cercanas')).toBeTruthy();
  });

  it('denied: botón "Permitir ubicación" que llama a retry, y los favoritos siguen visibles', async () => {
    mockLocation = { status: 'denied', coords: null, retry: jest.fn() };
    useFavorites.setState({ items: [{ lineId: '1', stopCode: 'A' }] });
    await renderScreen();
    expect(screen.getByText('Plaza Cercana')).toBeTruthy(); // favorito
    await fireEvent.press(screen.getByText('Permitir ubicación'));
    expect(mockLocation.retry).toHaveBeenCalledTimes(1);
  });

  it('un favorito abre Horarios al tocarlo', async () => {
    useFavorites.setState({ items: [{ lineId: '1', stopCode: 'A' }] });
    mockLocation = { status: 'waiting', coords: null, retry: jest.fn() };
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Abrir Línea 1 en Plaza Cercana'));
    expect(mockPush.mock.calls[0][0].params).toMatchObject({ line: '1', stop: 'A' });
  });

  it('waiting: muestra "Buscando tu posición…"', async () => {
    mockLocation = { status: 'waiting', coords: null, retry: jest.fn() };
    await renderScreen();
    expect(screen.getByText('Buscando tu posición…')).toBeTruthy();
  });

  it('unavailable: avisa con honestidad y ofrece reintentar', async () => {
    mockLocation = { status: 'unavailable', coords: null, retry: jest.fn() };
    await renderScreen();
    expect(screen.getByText(/No se puede obtener tu ubicación/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Permitir ubicación'));
    expect(mockLocation.retry).toHaveBeenCalledTimes(1);
  });
});
