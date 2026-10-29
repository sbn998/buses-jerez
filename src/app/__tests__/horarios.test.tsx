// Prueba de la pantalla Horarios con unos datos pequeños y los parámetros ?line=1&stop=343.
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DataProvider } from '@/data/DataProvider';
import type { Dataset } from '@/data/schema';
import { initI18n } from '@/i18n';
import { useFavorites } from '@/stores/favorites';

import Horarios from '../(tabs)/horarios';

let mockParams: { line?: string; stop?: string; nonce?: string } = {};
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));

const times = { lab: ['07:28', '10:14'], sab: ['09:00'], fes: ['10:00'] };
const data: Dataset = {
  schemaVersion: 1,
  generatedAt: '2026-10-28T00:00:00Z',
  holidays: [],
  stops: {
    '343': { code: '343', name: 'Plaza Esteve', description: '', lat: 0, lon: 0, coordSource: 'kml' },
    '344': { code: '344', name: 'Alameda Cristina', description: '', lat: 0, lon: 0, coordSource: 'kml' },
  },
  lines: [
    {
      id: '1',
      name: 'Esteve - San Telmo',
      colour: '#FFDE4D',
      stopCodes: ['343', '344'],
      directions: [{ headsign: 'San Telmo', stopCodes: ['343', '344'] }],
      shapes: [],
      timesByStop: { '343': times, '344': times },
      trips: { lab: [], sab: [], fes: [] },
    },
  ],
};

function renderScreen() {
  return render(
    <DataProvider value={{ data, source: 'bundled', checkedAt: null }}>
      <Horarios />
    </DataProvider>,
  );
}

beforeAll(() => {
  initI18n('es');
});
beforeEach(() => {
  useFavorites.setState({ items: [] });
});

describe('pantalla Horarios', () => {
  it('con line y stop muestra la parada, la tira de días y la estrella; la estrella guarda el favorito', async () => {
    mockParams = { line: '1', stop: '343' };
    await renderScreen();
    expect(screen.getByText('Plaza Esteve')).toBeTruthy();
    expect(screen.getByTestId('day-strip')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Añadir a favoritos'));
    expect(useFavorites.getState().items).toContainEqual({ lineId: '1', stopCode: '343' });
  });

  it('en una línea de un solo sentido no escribe "hacia …"', async () => {
    mockParams = { line: '1', stop: '343' };
    await renderScreen();
    expect(screen.queryByText(/hacia/i)).toBeNull();
  });

  it('en una línea con dos sentidos sí escribe "hacia …"', async () => {
    mockParams = { line: '1', stop: '343' };
    const dos: Dataset = {
      ...data,
      lines: [
        {
          ...data.lines[0],
          directions: [
            { headsign: 'San Telmo', stopCodes: ['343'] },
            { headsign: 'Alameda', stopCodes: ['344'] },
          ],
        },
      ],
    };
    await render(
      <DataProvider value={{ data: dos, source: 'bundled', checkedAt: null }}>
        <Horarios />
      </DataProvider>,
    );
    expect(screen.getAllByText('Hacia San Telmo').length).toBeGreaterThan(0);
  });

  it('sin parámetros no preselecciona nada: muestra favoritos vacíos y el selector de línea', async () => {
    mockParams = {};
    await renderScreen();
    expect(screen.getByText('Elige una línea')).toBeTruthy();
    expect(screen.queryByTestId('day-strip')).toBeNull();
  });

  it('mismos parámetros con un nonce nuevo vuelven a aplicarse', async () => {
    mockParams = { line: '1', stop: '343', nonce: '1' };
    const view = await renderScreen();
    expect(screen.getByText('Plaza Esteve')).toBeTruthy();

    // El usuario cambia de línea dentro de la pantalla: ya no se ve la parada.
    await fireEvent.press(screen.getByLabelText('Cambiar línea'));
    expect(screen.queryByText('Plaza Esteve')).toBeNull();

    // Llega la misma línea y parada, pero con otro nonce: se vuelve a abrir la parada 343.
    mockParams = { line: '1', stop: '343', nonce: '2' };
    await view.rerender(
      <DataProvider value={{ data, source: 'bundled', checkedAt: null }}>
        <Horarios />
      </DataProvider>,
    );
    expect(screen.getByText('Plaza Esteve')).toBeTruthy();
  });
});
