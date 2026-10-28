// Prueba de que los datos pasados con la propiedad `value` llegan a useData() (así otras pruebas pueden usar datos pequeños).
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DataProvider, useData } from '../DataProvider';
import type { Dataset } from '../schema';

function Probe() {
  const { data, source, checkedAt } = useData();
  return <Text>{`${data.generatedAt}|${source}|${checkedAt}`}</Text>;
}

it('passes the value prop to useData', async () => {
  const data: Dataset = { schemaVersion: 1, generatedAt: 'fake-date', lines: [], stops: {}, holidays: [] };
  await render(
    <DataProvider value={{ data, source: 'downloaded', checkedAt: 'ayer' }}>
      <Probe />
    </DataProvider>,
  );
  expect(screen.getByText('fake-date|downloaded|ayer')).toBeTruthy();
});
