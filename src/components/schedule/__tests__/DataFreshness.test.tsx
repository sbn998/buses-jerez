// Pruebas del pie de datos: con la copia incluida en la app también se enseña la fecha de los horarios.
import { render, screen } from '@testing-library/react-native';

import { DataProvider } from '@/data/DataProvider';
import type { Dataset } from '@/data/schema';
import { initI18n } from '@/i18n';

import { DataFreshness } from '../DataFreshness';

beforeAll(() => {
  initI18n('es');
});

const data: Dataset = {
  schemaVersion: 1,
  generatedAt: '2026-10-28T12:00:00.000Z',
  holidays: [],
  stops: {},
  lines: [],
};

describe('DataFreshness', () => {
  it('con la copia incluida muestra la fecha de generación de los datos', async () => {
    await render(
      <DataProvider value={{ data, source: 'bundled', checkedAt: null }}>
        <DataFreshness />
      </DataProvider>,
    );
    const date = new Date(data.generatedAt).toLocaleDateString('es');
    expect(
      screen.getByText(`Horarios oficiales de Comujesa · copia incluida en la app, del ${date}`),
    ).toBeTruthy();
  });

  it('con datos descargados muestra la fecha de comprobación', async () => {
    await render(
      <DataProvider value={{ data, source: 'downloaded', checkedAt: '2026-10-29T08:00:00.000Z' }}>
        <DataFreshness />
      </DataProvider>,
    );
    const date = new Date('2026-10-29T08:00:00.000Z').toLocaleDateString('es');
    expect(screen.getByText(`Horarios oficiales de Comujesa · comprobados el ${date}`)).toBeTruthy();
  });
});
