// Pruebas de JerezMap: pinta el mapa, avisa de las paradas tocadas y no bloquea si el mapa falla.
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { Stop } from '@/data/schema';
import { initI18n } from '@/i18n';
import { JEREZ_BOUNDS, MAP_STYLE_URL } from '@/lib/mapLayers';

import { JerezMap } from '../JerezMap';

// Ayudas que solo existen en el mock de MapLibre (carpeta __mocks__ de la raíz).
const { failMapLoading, getRecorded, resetMock } = jest.requireMock('@maplibre/maplibre-react-native');

beforeAll(() => {
  initI18n('es');
});

beforeEach(() => {
  resetMock();
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

  it('usa el estilo del mapa de Jerez', async () => {
    await render(<JerezMap height={200} />);
    expect(getRecorded().map.mapStyle).toBe(MAP_STYLE_URL);
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

  it('sin datos de vista, la cámara abarca toda la zona de Jerez', async () => {
    await render(<JerezMap height={200} />);
    expect(getRecorded().camera.initialViewState).toEqual({ bounds: JEREZ_BOUNDS });
  });

  it('con solo centro, usa zoom 14', async () => {
    await render(<JerezMap height={200} center={[-6.13, 36.68]} />);
    expect(getRecorded().camera.initialViewState).toEqual({ center: [-6.13, 36.68], zoom: 14 });
  });

  it('bounds manda sobre center', async () => {
    const bounds: [number, number, number, number] = [-6.2, 36.6, -6.0, 36.7];
    await render(<JerezMap height={200} center={[-6.13, 36.68]} zoom={12} bounds={bounds} />);
    const view = getRecorded().camera.initialViewState;
    expect(view.bounds).toEqual(bounds);
    expect(view.center).toBeUndefined();
  });

  it('la capa de paradas es de círculos y la del recorrido de líneas con el color de la línea', async () => {
    await render(
      <JerezMap height={200} stops={[stop]} shapes={{ shapes: [[[-6.1, 36.6], [-6.2, 36.7]]], colour: '#ff0000' }} />,
    );
    const { layers } = getRecorded();
    expect(layers['stops-circle'].type).toBe('circle');
    expect(layers['shapes-line'].type).toBe('line');
    expect(layers['shapes-line'].paint['line-color']).toEqual(['get', 'colour']);
    expect(layers['shapes-line'].paint['line-width']).toBe(4);
  });

  it('dibuja al usuario como círculo azul solo si hay posición', async () => {
    await render(<JerezMap height={200} user={{ lat: 36.68, lon: -6.13 }} />);
    expect(getRecorded().layers['user-circle'].paint['circle-color']).toBe('#2563eb');
  });
});
