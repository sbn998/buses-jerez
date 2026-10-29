// Pruebas del recuadro de reserva de JerezMap: si MapLibre no carga o falla al pintar,
// se ve "Mapa no disponible sin conexión" y el motivo queda en la consola (solo en desarrollo).
import { render, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';

import { JerezMap } from '../JerezMap';

// "mock" al principio del nombre: Jest permite usar esta variable dentro de jest.mock.
let mockMode: 'no-module' | 'render-error' = 'no-module';

jest.mock('@maplibre/maplibre-react-native', () => {
  // Simula que el módulo nativo no existe (como en Expo Go) o que el mapa lanza un error al pintarse.
  if (mockMode === 'no-module') throw new Error('sin módulo nativo');
  return {
    Map: () => {
      throw new Error('fallo al pintar');
    },
    Camera: () => null,
    GeoJSONSource: () => null,
    Layer: () => null,
  };
});

beforeAll(() => {
  initI18n('es');
});

describe('JerezMap con MapLibre roto', () => {
  it('sin módulo nativo muestra el recuadro y avisa por consola', async () => {
    mockMode = 'no-module';
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await render(<JerezMap height={200} />);
    expect(screen.getByText('Mapa no disponible sin conexión')).toBeTruthy();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('si el mapa lanza un error al pintarse muestra el recuadro y avisa por consola', async () => {
    mockMode = 'render-error';
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {}); // React también registra el error
    await render(<JerezMap height={200} />);
    expect(screen.getByText('Mapa no disponible sin conexión')).toBeTruthy();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });
});
