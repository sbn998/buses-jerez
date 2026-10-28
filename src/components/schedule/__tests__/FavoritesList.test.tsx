// Pruebas de FavoritesList: no enseña favoritos cuya parada ya no es de su línea.
import { render, screen } from '@testing-library/react-native';

import { DataProvider } from '@/data/DataProvider';
import type { Dataset } from '@/data/schema';
import { initI18n } from '@/i18n';

import { FavoritesList } from '../FavoritesList';

beforeAll(() => {
  initI18n('es');
});

const stop = (code: string) => ({ code, name: `Parada ${code}`, description: '', lat: 0, lon: 0, coordSource: 'kml' as const });
const times = { lab: ['10:14'], sab: ['10:14'], fes: ['10:14'] };
const data: Dataset = {
  schemaVersion: 1,
  generatedAt: '',
  holidays: [],
  stops: { '1': stop('1'), '2': stop('2') },
  lines: [
    { id: 'A', name: 'A', colour: '#fff', stopCodes: ['1'], directions: [], shapes: [], timesByStop: { '1': times }, trips: { lab: [], sab: [], fes: [] } },
  ],
};

it('muestra el favorito válido y omite el de una parada que ya no es de la línea', async () => {
  await render(
    <DataProvider value={{ data, source: 'bundled', checkedAt: null }}>
      <FavoritesList
        items={[
          { lineId: 'A', stopCode: '1' },
          { lineId: 'A', stopCode: '2' },
        ]}
        now={new Date(2026, 9, 28, 10, 5)}
        onSelect={() => {}}
      />
    </DataProvider>,
  );
  expect(screen.getByText('Parada 1')).toBeTruthy();
  expect(screen.queryByText('Parada 2')).toBeNull();
  expect(screen.queryByText('No quedan buses hoy')).toBeNull();
});
