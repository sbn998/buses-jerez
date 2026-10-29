// Prueba de la pantalla Opciones: cambiar el idioma y ver el pie de datos.
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DataProvider } from '@/data/DataProvider';
import type { Dataset } from '@/data/schema';
import { initI18n } from '@/i18n';
import { useSettings } from '@/stores/settings';

import Opciones from '../opciones';

const data: Dataset = {
  schemaVersion: 1,
  generatedAt: '2026-10-28T00:00:00Z',
  holidays: [],
  stops: {},
  lines: [],
};

beforeAll(() => {
  initI18n('es');
});
beforeEach(() => {
  useSettings.setState({ language: 'auto' });
});

function renderScreen() {
  return render(
    <DataProvider value={{ data, source: 'bundled', checkedAt: null }}>
      <Opciones />
    </DataProvider>,
  );
}

describe('pantalla Opciones', () => {
  it('al pulsar English guarda el idioma en en', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('English'));
    expect(useSettings.getState().language).toBe('en');
  });

  it('muestra el pie de datos, la fuente y el mapa sin conexión', async () => {
    await renderScreen();
    expect(screen.getByText(/copia incluida en la app/)).toBeTruthy();
    expect(screen.getByText('Datos oficiales de Comujesa')).toBeTruthy();
    expect(screen.getByText('Disponible pronto')).toBeTruthy();
  });
});
