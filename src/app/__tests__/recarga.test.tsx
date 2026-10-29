// Prueba de la pantalla Recarga con datos pequeños: zonas, notas, pie con enlace y copia antigua sin puntos.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { DataProvider } from '@/data/DataProvider';
import type { Dataset } from '@/data/schema';
import { initI18n } from '@/i18n';

import Recarga from '../(tabs)/recarga';

const base: Dataset = {
  schemaVersion: 1,
  generatedAt: '2026-10-28T00:00:00Z',
  holidays: [],
  stops: {},
  lines: [],
};

const withPoints: Dataset = {
  ...base,
  topUpChecked: '2026-10-29',
  topUpPoints: [
    { name: 'Oficina de Atención al Usuario', address: 'C/ Latorre, 3', zone: 'oficina' },
    { name: 'Estación de Autobuses', address: 'Plaza de la Estación', zone: 'oficina', note: 'Solo mañanas, de 08:00 a 14:30' },
    { name: 'Estanco Capuchinos', address: 'Pq. Capuchinos, 1', zone: 'centro' },
  ],
};

function renderScreen(data: Dataset) {
  return render(
    <DataProvider value={{ data, source: 'bundled', checkedAt: null }}>
      <Recarga />
    </DataProvider>,
  );
}

beforeAll(() => {
  initI18n('es');
});
beforeEach(() => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue();
  (Linking.openURL as jest.Mock).mockClear();
});

describe('pantalla Recarga', () => {
  it('muestra el texto de ayuda, las zonas con sus puntos, la nota y el pie con la fecha', async () => {
    await renderScreen(withPoints);
    expect(screen.getByText('Dónde recargar la tarjeta Multiviaje, Azul o Mensual')).toBeTruthy();
    expect(screen.getByText('Oficina de Atención al Usuario')).toBeTruthy();
    expect(screen.getByText('C/ Latorre, 3')).toBeTruthy();
    expect(screen.getByText('Oficinas')).toBeTruthy();
    expect(screen.getByText('Centro')).toBeTruthy();
    expect(screen.getByText('Estanco Capuchinos')).toBeTruthy();
    expect(screen.getByText('Solo mañanas, de 08:00 a 14:30')).toBeTruthy();
    expect(screen.getByText('Según el cartel oficial de Comujesa · revisado el 29/10/2026')).toBeTruthy();
    expect(screen.getByText('El mapa llegará pronto')).toBeTruthy();
  });

  it('el enlace del pie abre la página oficial', async () => {
    await renderScreen(withPoints);
    await fireEvent.press(screen.getByText('Ver en la web de Comujesa'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://www.comujesa.es/autobuses-urbanos/punto-venta-multiviaje');
  });

  it('sin topUpPoints (copia antigua) remite a la web de Comujesa', async () => {
    await renderScreen(base);
    expect(screen.getByText('Consulta los puntos de recarga en la web de Comujesa')).toBeTruthy();
    expect(screen.queryByText('Oficinas')).toBeNull();
    await fireEvent.press(screen.getByText('Ver en la web de Comujesa'));
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
  });
});
