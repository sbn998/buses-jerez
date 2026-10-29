// Prueba de la pantalla Cerca de mí con datos pequeños, posición y reloj simulados.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

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

// Ayudas que solo existen en el mock de MapLibre (carpeta __mocks__ de la raíz).
const { failMapLoading, breakMapRendering, getRecorded, resetMock } = jest.requireMock('@maplibre/maplibre-react-native');

beforeAll(() => {
  initI18n('es');
});
beforeEach(() => {
  resetMock();
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

  it('el título dice "Paradas a menos de 500 m" si las hay, y "Paradas más cercanas" si no', async () => {
    const view = await renderScreen();
    expect(screen.getByText('Paradas a menos de 500 m')).toBeTruthy();
    expect(screen.queryByText('Paradas más cercanas')).toBeNull();
    await view.unmount();

    mockLocation = { status: 'ready', coords: { lat: 0.1, lon: 0 }, retry: jest.fn() };
    await renderScreen();
    expect(screen.getByText('Paradas más cercanas')).toBeTruthy();
    expect(screen.queryByText('Paradas a menos de 500 m')).toBeNull();
  });

  it('con una precisión de 500 m avisa de que es aproximada y no enseña minutos andando', async () => {
    mockLocation = { status: 'ready', coords: { lat: 0, lon: 0 }, accuracy: 500, coarse: false, retry: jest.fn() };
    await renderScreen();
    expect(screen.getByText('Tu ubicación es aproximada (±500 m). Las distancias pueden no ser exactas.')).toBeTruthy();
    expect(screen.getByText('111 m')).toBeTruthy();
    expect(screen.queryByText(/\d+ m · \d+ min/)).toBeNull();
  });

  it('con una precisión de 20 m no hay aviso y se enseñan los minutos', async () => {
    mockLocation = { status: 'ready', coords: { lat: 0, lon: 0 }, accuracy: 20, coarse: false, retry: jest.fn() };
    await renderScreen();
    expect(screen.queryByText(/Tu ubicación es aproximada/)).toBeNull();
    expect(screen.getByText('111 m · 2 min')).toBeTruthy();
  });

  it('con permiso de ubicación aproximada (coarse) avisa aunque no se conozca la precisión', async () => {
    mockLocation = { status: 'ready', coords: { lat: 0, lon: 0 }, accuracy: null, coarse: true, retry: jest.fn() };
    await renderScreen();
    expect(screen.getByText(/Tu ubicación es aproximada/)).toBeTruthy();
    expect(screen.queryByText('111 m · 2 min')).toBeNull();
  });

  it('blocked: enseña "Abrir ajustes" y al pulsarlo abre los ajustes del móvil', async () => {
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    mockLocation = { status: 'blocked', coords: null, retry: jest.fn() };
    await renderScreen();
    await fireEvent.press(screen.getByText('Abrir ajustes'));
    expect(open).toHaveBeenCalledTimes(1);
    open.mockRestore();
  });

  it('asking: muestra "Pidiendo permiso…"', async () => {
    mockLocation = { status: 'asking', coords: null, retry: jest.fn() };
    await renderScreen();
    expect(screen.getByText('Pidiendo permiso…')).toBeTruthy();
  });

  it('nosignal: avisa de que no hay señal GPS y ofrece reintentar', async () => {
    mockLocation = { status: 'nosignal', coords: null, retry: jest.fn() };
    await renderScreen();
    expect(screen.getByText(/No encontramos señal GPS/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Permitir ubicación'));
    expect(mockLocation.retry).toHaveBeenCalledTimes(1);
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

  describe('mapa', () => {
    it('con posición, enseña el mapa con las paradas', async () => {
      await renderScreen();
      expect(screen.getByTestId('map-view')).toBeTruthy();
      expect(screen.getByTestId('shape-source-stops')).toBeTruthy();
    });

    it('sin posición no enseña el mapa y mantiene el estado de ubicación', async () => {
      mockLocation = { status: 'denied', coords: null, retry: jest.fn() };
      await renderScreen();
      expect(screen.queryByTestId('map-view')).toBeNull();
      expect(screen.getByText('Permitir ubicación')).toBeTruthy();
    });

    it('al tocar una parada en el mapa se abre su tarjeta', async () => {
      await renderScreen();
      expect(screen.queryByText('hacia Destino 3')).toBeNull();
      await fireEvent.press(screen.getByTestId('press-stops-B'));
      expect(screen.getByText('hacia Destino 3')).toBeTruthy();
    });

    it('map error: el mapa sigue con fondo liso y aviso, y la lista sigue visible', async () => {
      await renderScreen();
      await act(async () => failMapLoading());
      expect(screen.getByText('Mapa no disponible ahora mismo')).toBeTruthy();
      expect(screen.getByTestId('map-view')).toBeTruthy();
      expect(screen.getByText('Plaza Cercana')).toBeTruthy();
      // Con fondo liso las paradas se siguen dibujando, así que la leyenda se mantiene.
      expect(screen.getByText('○ ubicación aproximada')).toBeTruthy();
    });

    it('sin motor de mapas (solo el recuadro de texto) no sale la leyenda de ubicación aproximada', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      breakMapRendering();
      await renderScreen();
      expect(screen.getByText('Mapa no disponible ahora mismo')).toBeTruthy();
      expect(screen.queryByText('○ ubicación aproximada')).toBeNull();
      expect(screen.getByText('Plaza Cercana')).toBeTruthy();
      jest.restoreAllMocks();
    });

    it('encuadra el mapa con la posición del usuario y las paradas mostradas', async () => {
      await renderScreen();
      // Usuario en (0, 0); paradas A (lat 0.001) y B (lat 0.003), ambas dentro de 500 m.
      const view = getRecorded().camera.initialViewState;
      expect(view.bounds).toEqual([0, 0, 0, 0.003]);
      expect(view.center).toBeUndefined();
    });

    it('si el usuario y la única parada coinciden, centra en el usuario con zoom 15', async () => {
      mockLocation = { status: 'ready', coords: { lat: 0.001, lon: 0 }, retry: jest.fn() };
      const only = { ...data, lines: [makeLine('1', ['A'], ['10:30'])], stops: { A: data.stops.A } };
      await render(
        <DataProvider value={{ data: only, source: 'bundled', checkedAt: null }}>
          <Cerca />
        </DataProvider>,
      );
      const view = getRecorded().camera.initialViewState;
      expect(view.bounds).toBeUndefined();
      expect(view.center).toEqual([0, 0.001]);
      expect(view.zoom).toBe(15);
    });

    it('la leyenda de ubicación aproximada sale solo si alguna parada lo es', async () => {
      const view = await renderScreen();
      expect(screen.getByText('○ ubicación aproximada')).toBeTruthy();
      await view.unmount();

      // Con la parada B lejos (fuera de 500 m) y la A cerca, solo se enseña A, que es exacta.
      const exact = { ...data.stops.B, approximate: false };
      const exactData: Dataset = { ...data, stops: { ...data.stops, B: exact } };
      await render(
        <DataProvider value={{ data: exactData, source: 'bundled', checkedAt: null }}>
          <Cerca />
        </DataProvider>,
      );
      expect(screen.queryByText('○ ubicación aproximada')).toBeNull();
    });

    it('"Centrar en mí" vuelve a encuadrar al usuario y las paradas', async () => {
      await renderScreen();
      expect(getRecorded().cameraCalls).toEqual([]);
      await fireEvent.press(screen.getByRole('button', { name: 'Centrar en mí' }));
      const calls = getRecorded().cameraCalls;
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe('fitBounds');
      expect(calls[0].args[0]).toEqual([0, 0, 0, 0.003]);
    });

    it('"Centrar en mí" con una sola posición vuela al usuario', async () => {
      mockLocation = { status: 'ready', coords: { lat: 0.001, lon: 0 }, retry: jest.fn() };
      const only = { ...data, lines: [makeLine('1', ['A'], ['10:30'])], stops: { A: data.stops.A } };
      await render(
        <DataProvider value={{ data: only, source: 'bundled', checkedAt: null }}>
          <Cerca />
        </DataProvider>,
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Centrar en mí' }));
      expect(getRecorded().cameraCalls).toEqual([{ method: 'flyTo', args: [{ center: [0, 0.001], zoom: 15 }] }]);
    });

    it('sin ubicación (permiso denegado) no hay botón "Centrar en mí" y nada se rompe', async () => {
      mockLocation = { status: 'denied', coords: null, retry: jest.fn() };
      await renderScreen();
      expect(screen.queryByRole('button', { name: 'Centrar en mí' })).toBeNull();
      expect(getRecorded().cameraCalls).toEqual([]);
    });
  });
});
