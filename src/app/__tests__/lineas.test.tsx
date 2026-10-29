// Prueba de la pestaña Líneas: lista ordenada con las 18 líneas y navegación al detalle.
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DataProvider } from '@/data/DataProvider';
import type { Dataset, Line } from '@/data/schema';
import { initI18n } from '@/i18n';

import Lineas from '../(tabs)/lineas';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

function makeLine(id: string): Line {
  return {
    id,
    name: `Nombre ${id}`,
    colour: '#FFDE4D',
    stopCodes: [],
    directions: [],
    shapes: [],
    timesByStop: {},
    trips: { lab: [], sab: [], fes: [] },
  };
}

// 18 líneas, entregadas a propósito en orden alfabético ("1", "10", "11"... "2") para
// comprobar que la pantalla las ordena como números.
const ids = Array.from({ length: 18 }, (_, i) => String(i + 1)).sort();
const data: Dataset = {
  schemaVersion: 1,
  generatedAt: '2026-10-28T00:00:00Z',
  holidays: [],
  stops: {},
  lines: ids.map(makeLine),
};

beforeAll(() => {
  initI18n('es');
});
beforeEach(() => mockPush.mockClear());

describe('pestaña Líneas', () => {
  it('muestra las 18 líneas en orden numérico y al pulsar una abre su detalle', async () => {
    await render(
      <DataProvider value={{ data, source: 'bundled', checkedAt: null }}>
        <Lineas />
      </DataProvider>,
    );
    const rows = screen.getAllByRole('button');
    expect(rows).toHaveLength(18);
    expect(screen.getByText('Nombre 1')).toBeTruthy();
    expect(screen.getByText('Nombre 18')).toBeTruthy();
    expect(rows[0].props.accessibilityLabel).toBe('Línea 1');
    expect(rows[1].props.accessibilityLabel).toBe('Línea 2');

    await fireEvent.press(rows[0]);
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/lineas/1');
  });
});
