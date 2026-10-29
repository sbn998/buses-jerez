// Prueba de la pantalla Cómo llego: conexión, origen y búsqueda de destino, con todo simulado (sin red).
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { DataProvider } from '@/data/DataProvider';
import type { Dataset, Line } from '@/data/schema';
import { initI18n } from '@/i18n';
import { isOnline } from '@/lib/online';
import { type Place, SearchError, searchPlaces } from '@/lib/placeSearch';

import ComoLlego from '../(tabs)/como-llego';

jest.mock('@/lib/online', () => ({ isOnline: jest.fn() }));
jest.mock('@/lib/placeSearch', () => ({
  ...jest.requireActual('@/lib/placeSearch'),
  searchPlaces: jest.fn(),
}));

let mockLocation: any = { status: 'ready', coords: { lat: 36.68, lon: -6.13 }, retry: jest.fn() };
jest.mock('@/hooks/use-location', () => ({ useLocation: () => mockLocation }));

// Hora simulada (se cambia en las pruebas que la necesitan). Miércoles 28 de octubre de 2026.
let mockNow = new Date(2026, 9, 28, 10, 0, 0);
jest.mock('@/hooks/use-now', () => ({ useNow: () => mockNow }));

// Ayudas que solo existen en el mock de MapLibre (carpeta __mocks__ de la raíz).
const { getRecorded, resetMock } = jest.requireMock('@maplibre/maplibre-react-native');

const mockOnline = isOnline as jest.Mock;
const mockSearch = searchPlaces as jest.Mock;

const luz: Place = { id: 'N1', name: 'Calle Luz', detail: 'Centro', lat: 36.68, lon: -6.13 };
const plaza: Place = { id: 'N2', name: 'Plaza del Arenal', detail: 'Centro', lat: 36.681, lon: -6.137 };

// Datos pequeños. Origen = (36.68, -6.13). Línea 1 (amarilla): sube en A (55 m) y baja en D2, algo lejos del
// destino: llega antes pero se anda más. Línea 2 (roja): de A a D1 (junto al destino): llega después, se anda menos.
function makeLine(id: string, colour: string, stopCodes: string[], lab: string[]): Line {
  return {
    id,
    name: `Línea ${id}`,
    colour,
    stopCodes,
    directions: [{ headsign: `Destino ${id}`, stopCodes }],
    shapes: [],
    timesByStop: {},
    trips: { lab: [lab], sab: [], fes: [] },
  };
}
const stopAt = (code: string, name: string, lat: number) => ({
  code,
  name,
  description: '',
  lat,
  lon: -6.13,
  coordSource: 'kml' as const,
});
const data: Dataset = {
  schemaVersion: 1,
  generatedAt: '2026-10-28T00:00:00Z',
  holidays: [],
  stops: {
    A: stopAt('A', 'Parada Origen', 36.6805),
    D1: stopAt('D1', 'Parada Destino', 36.6995),
    D2: stopAt('D2', 'Parada Media', 36.696),
  },
  lines: [
    makeLine('1', '#FFDE4D', ['A', 'D2'], ['10:05', '10:10']),
    makeLine('2', '#CC0033', ['A', 'D1'], ['10:05', '10:30']),
  ],
};
// Los datos que usa la pantalla (algunas pruebas los cambian).
let screenData: Dataset = data;
// Destino lejos (a unos 2,2 km) y destino a 200 m del origen.
const lejos: Place = { id: 'N3', name: 'Hospital', detail: 'Norte', lat: 36.7, lon: -6.13 };
const cerquita: Place = { id: 'N4', name: 'Kiosco', detail: 'Centro', lat: 36.6818, lon: -6.13 };

beforeAll(() => {
  initI18n('es');
});
afterEach(() => {
  jest.restoreAllMocks();
});
beforeEach(() => {
  resetMock();
  screenData = data;
  mockNow = new Date(2026, 9, 28, 10, 0, 0);
  mockOnline.mockReset().mockResolvedValue(true);
  mockSearch.mockReset().mockResolvedValue([luz]);
  mockLocation = { status: 'ready', coords: { lat: 36.68, lon: -6.13 }, retry: jest.fn() };
});

// Pinta la pantalla con los datos pequeños de arriba.
function renderWithData() {
  return render(
    <DataProvider value={{ data: screenData, source: 'bundled', checkedAt: null }}>
      <ComoLlego />
    </DataProvider>,
  );
}

async function renderScreen() {
  const view = await renderWithData();
  // Espera a que termine la comprobación de conexión.
  await screen.findByLabelText('Buscar un lugar');
  return view;
}

async function search(text: string) {
  await fireEvent.changeText(screen.getByLabelText('Buscar un lugar'), text);
  await fireEvent.press(screen.getByRole('button', { name: 'Buscar' }));
}

describe('pantalla Cómo llego', () => {
  it('con conexión enseña la cabecera, el origen "tu ubicación" y el buscador', async () => {
    await renderScreen();
    expect(screen.getByText('Escribe un lugar o una calle')).toBeTruthy();
    expect(screen.getByText('Desde: tu ubicación')).toBeTruthy();
    expect(screen.getByLabelText('Buscar un lugar')).toBeTruthy();
  });

  it('sin conexión enseña el aviso a pantalla completa y no el buscador; Reintentar con conexión enseña el buscador', async () => {
    mockOnline.mockResolvedValue(false);
    await renderWithData();
    expect(await screen.findByText('Esta función necesita conexión')).toBeTruthy();
    expect(screen.queryByLabelText('Buscar un lugar')).toBeNull();

    mockOnline.mockResolvedValue(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByLabelText('Buscar un lugar')).toBeTruthy();
    expect(screen.queryByText('Esta función necesita conexión')).toBeNull();
  });

  it('al volver a primer plano vuelve a comprobar la conexión', async () => {
    let listener: (state: string) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, fn: (s: string) => void) => {
      listener = fn;
      return { remove };
    }) as never);
    const view = await renderScreen();
    expect(mockOnline).toHaveBeenCalledTimes(1);
    mockOnline.mockResolvedValue(false);
    await act(async () => listener('active'));
    expect(await screen.findByText('Esta función necesita conexión')).toBeTruthy();
    expect(mockOnline).toHaveBeenCalledTimes(2);
    await view.unmount();
    expect(remove).toHaveBeenCalled();
  });

  it('al volver a primer plano con conexión no se pierde lo escrito', async () => {
    let listener: (state: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, fn: (s: string) => void) => {
      listener = fn;
      return { remove: jest.fn() };
    }) as never);
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Buscar un lugar'), 'Luz');
    await act(async () => listener('active'));
    expect(mockOnline).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Buscar un lugar').props.value).toBe('Luz');
  });

  it('una comprobación de conexión antigua no pisa a la nueva', async () => {
    let listener: (state: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, fn: (s: string) => void) => {
      listener = fn;
      return { remove: jest.fn() };
    }) as never);
    // La primera comprobación (al abrir) tarda y dirá "hay conexión" cuando ya no importa.
    let resolveFirst: (v: boolean) => void = () => {};
    mockOnline.mockImplementationOnce(() => new Promise<boolean>((r) => (resolveFirst = r)));
    mockOnline.mockResolvedValueOnce(false);
    await renderWithData();
    await act(async () => listener('active'));
    expect(await screen.findByText('Esta función necesita conexión')).toBeTruthy();
    await act(async () => resolveFirst(true));
    expect(screen.getByText('Esta función necesita conexión')).toBeTruthy();
    expect(screen.queryByLabelText('Buscar un lugar')).toBeNull();
  });

  it('al buscar "Luz" sale la lista y al tocar un lugar queda como destino', async () => {
    await renderScreen();
    await search('Luz');
    await fireEvent.press(await screen.findByRole('button', { name: 'Calle Luz, Centro' }));
    expect(screen.getByText('Hacia: Calle Luz')).toBeTruthy();
    expect(screen.queryByLabelText('Buscar un lugar')).toBeNull();
  });

  it('"Cambiar destino" vuelve al buscador', async () => {
    await renderScreen();
    await search('Luz');
    await fireEvent.press(await screen.findByRole('button', { name: 'Calle Luz, Centro' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar destino' }));
    expect(screen.getByLabelText('Buscar un lugar')).toBeTruthy();
  });

  it('escribir sin pulsar Buscar no llama a searchPlaces', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Buscar un lugar'), 'Luz');
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('los errores busy, failed y 0 resultados enseñan su texto', async () => {
    await renderScreen();
    mockSearch.mockRejectedValueOnce(new SearchError('busy'));
    await search('Luz');
    expect(await screen.findByText('La búsqueda está saturada, prueba en un rato')).toBeTruthy();

    mockSearch.mockRejectedValueOnce(new SearchError('failed'));
    await search('Luz');
    expect(await screen.findByText('No se pudo buscar.')).toBeTruthy();

    mockSearch.mockResolvedValueOnce([]);
    await search('Luz');
    expect(await screen.findByText('No hemos encontrado ese sitio en Jerez')).toBeTruthy();
  });

  it('un error offline al buscar pasa al aviso a pantalla completa', async () => {
    await renderScreen();
    mockSearch.mockRejectedValueOnce(new SearchError('offline'));
    await search('Luz');
    expect(await screen.findByText('Esta función necesita conexión')).toBeTruthy();
    expect(screen.queryByLabelText('Buscar un lugar')).toBeNull();
  });

  it('con la ubicación denegada pide elegir el origen; al elegirlo se puede buscar el destino', async () => {
    mockLocation = { status: 'denied', coords: null, retry: jest.fn() };
    mockSearch.mockResolvedValue([plaza]);
    await renderScreen();
    expect(screen.getByText('Elige desde dónde sales')).toBeTruthy();
    expect(screen.getByPlaceholderText('Escribe de dónde sales')).toBeTruthy();
    await search('Plaza');
    await fireEvent.press(await screen.findByRole('button', { name: 'Plaza del Arenal, Centro' }));
    expect(screen.getByText('Desde: Plaza del Arenal')).toBeTruthy();
    expect(screen.queryByText('Elige desde dónde sales')).toBeNull();
    expect(screen.getByPlaceholderText('Escribe el destino')).toBeTruthy();
  });

  it('"Cambiar" el origen a un lugar lo muestra en "Desde: …"', async () => {
    mockSearch.mockResolvedValue([plaza]);
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar origen' }));
    await search('Plaza');
    await fireEvent.press(await screen.findByRole('button', { name: 'Plaza del Arenal, Centro' }));
    expect(screen.getByText('Desde: Plaza del Arenal')).toBeTruthy();
    expect(screen.getByPlaceholderText('Escribe el destino')).toBeTruthy();
  });

  it('"Usar mi ubicación" devuelve el origen a tu ubicación', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar origen' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Usar mi ubicación' }));
    expect(screen.getByText('Desde: tu ubicación')).toBeTruthy();
  });

  describe('opciones de ruta', () => {
    // Elige el destino buscándolo y tocándolo en la lista.
    async function pickDestination(place: Place) {
      mockSearch.mockResolvedValue([place]);
      await search(place.name);
      await fireEvent.press(await screen.findByRole('button', { name: `${place.name}, ${place.detail}` }));
    }
    const order = () => screen.getAllByTestId(/^route-option-/).map((n) => n.props.testID);
    const routeColours = () => getRecorded().sources.routes.data.features.map((f: any) => f.properties.colour);

    it('con origen y destino sale una tarjeta por opción con subida, bajada y "Distancias aproximadas"', async () => {
      await renderScreen();
      await pickDestination(lejos);
      expect(screen.getAllByText(/^Súbete en Parada Origen a las 10:05/)).toHaveLength(2);
      expect(screen.getAllByText(/^Bájate en /)).toHaveLength(2);
      expect(screen.getAllByText('Distancias aproximadas')).toHaveLength(2);
    });

    it('por defecto va ordenado por Más rápido; Menos andar reordena las tarjetas', async () => {
      await renderScreen();
      await pickDestination(lejos);
      expect(order()).toEqual(['route-option-1', 'route-option-2']);
      await fireEvent.press(screen.getByRole('button', { name: 'Menos andar' }));
      expect(order()).toEqual(['route-option-2', 'route-option-1']);
      await fireEvent.press(screen.getByRole('button', { name: 'Más rápido' }));
      expect(order()).toEqual(['route-option-1', 'route-option-2']);
    });

    it('el mapa recibe origen y destino y la ruta con el color de la línea elegida', async () => {
      await renderScreen();
      await pickDestination(lejos);
      const places = getRecorded().sources.places.data.features;
      expect(places.map((f: any) => f.properties.kind)).toEqual(['origin', 'destination']);
      expect(routeColours()).toEqual(['#FFDE4D']);
      // Las paradas de subida y bajada se marcan en el mapa.
      expect(getRecorded().sources.stops.data.features.map((f: any) => f.properties.code)).toEqual(['A', 'D2']);
      // El encuadre encierra el origen, el destino y la ruta.
      expect(getRecorded().camera.initialViewState.bounds).toEqual([-6.13, 36.68, -6.13, 36.7]);
    });

    it('tocar la segunda tarjeta cambia la ruta del mapa', async () => {
      await renderScreen();
      await pickDestination(lejos);
      expect(screen.getByTestId('route-option-1').props.accessibilityState).toMatchObject({ selected: true });
      await fireEvent.press(screen.getByTestId('route-option-2'));
      expect(routeColours()).toEqual(['#CC0033']);
      expect(screen.getByTestId('route-option-2').props.accessibilityState).toMatchObject({ selected: true });
      expect(screen.getByTestId('route-option-1').props.accessibilityState).toMatchObject({ selected: false });
    });

    it('a las 23:59 no quedan buses y lo dice, sin tarjetas', async () => {
      mockNow = new Date(2026, 9, 28, 23, 59, 0);
      await renderScreen();
      await pickDestination(lejos);
      expect(screen.getByText('Hoy ya no quedan buses para este trayecto')).toBeTruthy();
      expect(screen.queryAllByTestId(/^route-option-/)).toHaveLength(0);
    });

    it('si ninguna línea conecta los dos puntos ni a medianoche, lo dice y no dice "ya no quedan buses"', async () => {
      // Una línea aislada junto al destino: desde el origen no hay forma de llegar con 1 transbordo.
      screenData = {
        ...data,
        stops: { ...data.stops, Z1: stopAt('Z1', 'Isla 1', 36.74), Z2: stopAt('Z2', 'Isla 2', 36.75) },
        lines: [...data.lines, makeLine('9', '#00AA00', ['Z1', 'Z2'], ['10:05', '10:10'])],
      };
      await renderScreen();
      await pickDestination({ id: 'N5', name: 'Isla', detail: 'Norte', lat: 36.75, lon: -6.13 });
      expect(
        screen.getByText('No hay opciones en bus con como mucho 1 transbordo para este trayecto'),
      ).toBeTruthy();
      expect(screen.queryByText('Hoy ya no quedan buses para este trayecto')).toBeNull();
    });

    it('a mediodía, si hubo buses esta mañana pero ya no, sigue diciendo que hoy ya no quedan', async () => {
      mockNow = new Date(2026, 9, 28, 12, 0, 0);
      await renderScreen();
      await pickDestination(lejos);
      expect(screen.getByText('Hoy ya no quedan buses para este trayecto')).toBeTruthy();
      expect(screen.queryByText(/como mucho 1 transbordo/)).toBeNull();
    });

    it('mientras llega tu ubicación y ya hay destino, dice que la está buscando', async () => {
      mockLocation = { status: 'asking', coords: null, retry: jest.fn() };
      await renderScreen();
      await pickDestination(lejos);
      expect(screen.getByText('Buscando tu ubicación…')).toBeTruthy();
    });

    it('con el destino a 200 m sugiere ir andando y sigue enseñando los buses', async () => {
      await renderScreen();
      await pickDestination(cerquita);
      expect(screen.getByText('Está a 260 m: mejor ir andando (unos 4 min)')).toBeTruthy();
    });

    it('con el destino lejos no sugiere ir andando', async () => {
      await renderScreen();
      await pickDestination(lejos);
      expect(screen.queryByText(/mejor ir andando/)).toBeNull();
    });

    it('si el origen es un lugar escrito, se planifica desde ese lugar', async () => {
      mockLocation = { status: 'denied', coords: null, retry: jest.fn() };
      await renderScreen();
      mockSearch.mockResolvedValue([luz]);
      await search('Luz');
      await fireEvent.press(await screen.findByRole('button', { name: 'Calle Luz, Centro' }));
      await pickDestination(lejos);
      expect(screen.getAllByTestId(/^route-option-/)).toHaveLength(2);
    });
  });
});
