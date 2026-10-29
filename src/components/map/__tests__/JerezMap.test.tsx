// Pruebas de JerezMap: pinta el mapa, avisa de las paradas tocadas y no bloquea si el mapa falla.
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { Stop } from '@/data/schema';
import { initI18n } from '@/i18n';

import { JerezMap } from '../JerezMap';

// "failMapLoading" es una ayuda que solo existe en el mock de MapLibre.
const { failMapLoading } = jest.requireMock('@maplibre/maplibre-react-native');

beforeAll(() => {
  initI18n('es');
});

const stop: Stop = {
  code: '42',
  name: 'Plaza',
  description: '',
  lat: 36.68,
  lon: -6.13,
  coordSource: 'kml',
};

describe('JerezMap', () => {
  it('pinta el mapa y la fuente de paradas', async () => {
    await render(<JerezMap height={200} stops={[stop]} />);
    expect(screen.getByTestId('map-view')).toBeTruthy();
    expect(screen.getByTestId('shape-source-stops')).toBeTruthy();
  });

  it('muestra la atribución © OpenStreetMap', async () => {
    await render(<JerezMap height={200} />);
    expect(screen.getByText('© OpenStreetMap')).toBeTruthy();
  });

  it('si el mapa falla al cargar, muestra el recuadro de sin conexión', async () => {
    await render(<JerezMap height={200} />);
    await act(async () => failMapLoading());
    expect(screen.getByText('Mapa no disponible sin conexión')).toBeTruthy();
    expect(screen.queryByTestId('map-view')).toBeNull();
  });

  it('al tocar una parada llama a onStopPress con su código', async () => {
    const onStopPress = jest.fn();
    await render(<JerezMap height={200} stops={[stop]} onStopPress={onStopPress} />);
    fireEvent.press(screen.getByTestId('press-stops'));
    expect(onStopPress).toHaveBeenCalledWith('42');
  });
});
