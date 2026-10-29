// Prueba de la pantalla Cómo llego: conexión, origen y búsqueda de destino, con todo simulado (sin red).
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';

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

const mockOnline = isOnline as jest.Mock;
const mockSearch = searchPlaces as jest.Mock;

const luz: Place = { id: 'N1', name: 'Calle Luz', detail: 'Centro', lat: 36.68, lon: -6.13 };
const plaza: Place = { id: 'N2', name: 'Plaza del Arenal', detail: 'Centro', lat: 36.681, lon: -6.137 };

beforeAll(() => {
  initI18n('es');
});
beforeEach(() => {
  mockOnline.mockReset().mockResolvedValue(true);
  mockSearch.mockReset().mockResolvedValue([luz]);
  mockLocation = { status: 'ready', coords: { lat: 36.68, lon: -6.13 }, retry: jest.fn() };
});

async function renderScreen() {
  await render(<ComoLlego />);
  // Espera a que termine la comprobación de conexión.
  await screen.findByLabelText('Buscar un lugar');
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
    await render(<ComoLlego />);
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
    await renderScreen();
    expect(mockOnline).toHaveBeenCalledTimes(1);
    mockOnline.mockResolvedValue(false);
    await act(async () => listener('active'));
    expect(await screen.findByText('Esta función necesita conexión')).toBeTruthy();
    expect(mockOnline).toHaveBeenCalledTimes(2);
    jest.restoreAllMocks();
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
});
