// Pruebas de JerezMap: pinta el mapa, avisa de las paradas tocadas y no bloquea si el mapa falla.
import { AppState } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { Stop } from '@/data/schema';
import { initI18n } from '@/i18n';
import { JEREZ_BOUNDS, MAP_STYLE_URL } from '@/lib/mapLayers';
import { deleteOfflineMap, downloadOfflineMap, setOfflineFs, useOfflineMap } from '@/lib/offlineMap';
import { createFakeFs } from '@/lib/testing/fakeOfflineFs';

import { JerezMap } from '../JerezMap';

// Ayudas que solo existen en el mock de MapLibre (carpeta __mocks__ de la raíz).
const { failMapLoading, finishMapLoading, finishStyleLoading, breakMapRendering, getRecorded, resetMock } = jest.requireMock('@maplibre/maplibre-react-native');

beforeAll(() => {
  initI18n('es');
});

beforeEach(() => {
  resetMock();
});

afterEach(() => {
  setOfflineFs(null);
  useOfflineMap.setState({ status: { downloaded: false, bytes: 0 } });
  jest.useRealTimers();
  jest.restoreAllMocks();
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

  it('si el mapa falla al cargar, sigue el mapa con fondo liso, con paradas, aviso y botón de reintentar', async () => {
    await render(<JerezMap height={200} stops={[stop]} user={{ lat: 36.68, lon: -6.13 }} />);
    await act(async () => failMapLoading());
    const style = getRecorded().map.mapStyle;
    expect(typeof style).toBe('object');
    expect(style.layers[0].type).toBe('background');
    expect(screen.getByText('Mapa no disponible ahora mismo')).toBeTruthy();
    expect(screen.getByText('Reintentar')).toBeTruthy();
    // Las paradas y el usuario se siguen dibujando.
    expect(screen.getByTestId('map-view')).toBeTruthy();
    expect(screen.getByTestId('shape-source-stops')).toBeTruthy();
    expect(screen.getByTestId('shape-source-user')).toBeTruthy();
  });

  it('si no llega ningún evento de carga en 8 s, pasa al fondo liso con el aviso', async () => {
    jest.useFakeTimers();
    await render(<JerezMap height={200} stops={[stop]} />);
    await act(async () => {
      jest.advanceTimersByTime(7999);
    });
    expect(getRecorded().map.mapStyle).toBe(MAP_STYLE_URL);
    expect(screen.queryByText('Mapa no disponible ahora mismo')).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(getRecorded().map.mapStyle.layers[0].type).toBe('background');
    expect(screen.getByText('Mapa no disponible ahora mismo')).toBeTruthy();
    expect(screen.getByTestId('shape-source-stops')).toBeTruthy();
  });

  it.each([
    ['onDidFinishLoadingStyle', () => finishStyleLoading()],
    ['onDidFinishLoadingMap', () => finishMapLoading()],
  ])('si llega %s antes de 8 s, no hay fondo liso', async (_name, finish) => {
    jest.useFakeTimers();
    await render(<JerezMap height={200} />);
    await act(async () => finish());
    await act(async () => {
      jest.advanceTimersByTime(20000);
    });
    expect(getRecorded().map.mapStyle).toBe(MAP_STYLE_URL);
    expect(screen.queryByText('Mapa no disponible ahora mismo')).toBeNull();
  });

  it('Reintentar vuelve al estilo remoto y reinicia el temporizador', async () => {
    jest.useFakeTimers();
    await render(<JerezMap height={200} />);
    await act(async () => failMapLoading());
    expect(typeof getRecorded().map.mapStyle).toBe('object');
    await fireEvent.press(screen.getByText('Reintentar'));
    expect(getRecorded().map.mapStyle).toBe(MAP_STYLE_URL);
    expect(screen.queryByText('Mapa no disponible ahora mismo')).toBeNull();
    // El temporizador de 8 s vuelve a correr.
    await act(async () => {
      jest.advanceTimersByTime(8000);
    });
    expect(typeof getRecorded().map.mapStyle).toBe('object');
  });

  it('al volver la app a primer plano con el mapa en fondo liso, reintenta', async () => {
    let listener: (state: string) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, fn: (state: string) => void) => {
      listener = fn;
      return { remove };
    }) as never);
    await render(<JerezMap height={200} />);
    await act(async () => failMapLoading());
    expect(typeof getRecorded().map.mapStyle).toBe('object');
    await act(async () => listener('active'));
    expect(getRecorded().map.mapStyle).toBe(MAP_STYLE_URL);
  });

  it('al desmontar no quedan temporizadores', async () => {
    jest.useFakeTimers();
    const set = jest.spyOn(globalThis, 'setTimeout');
    const clear = jest.spyOn(globalThis, 'clearTimeout');
    const view = await render(<JerezMap height={200} />);
    // Buscamos el reloj de 8 s del mapa entre los temporizadores creados.
    const index = set.mock.calls.findIndex(([, ms]) => ms === 8000);
    expect(index).toBeGreaterThanOrEqual(0);
    const timerId = set.mock.results[index].value;
    await view.unmount();
    expect(clear).toHaveBeenCalledWith(timerId);
  });

  it('avisa del estado: loading, ready, fallback', async () => {
    const onStatusChange = jest.fn();
    await render(<JerezMap height={200} onStatusChange={onStatusChange} />);
    expect(onStatusChange).toHaveBeenLastCalledWith('loading');
    await act(async () => finishStyleLoading());
    expect(onStatusChange).toHaveBeenLastCalledWith('ready');
  });

  it('avisa fallback cuando el mapa falla', async () => {
    const onStatusChange = jest.fn();
    await render(<JerezMap height={200} onStatusChange={onStatusChange} />);
    await act(async () => failMapLoading());
    expect(onStatusChange).toHaveBeenLastCalledWith('fallback');
  });

  it('si Map lanza un error al pintarse, avisa unavailable y muestra el recuadro', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    breakMapRendering();
    const onStatusChange = jest.fn();
    await render(<JerezMap height={200} onStatusChange={onStatusChange} />);
    expect(screen.getByText('Mapa no disponible ahora mismo')).toBeTruthy();
    expect(onStatusChange).toHaveBeenLastCalledWith('unavailable');
  });

  it('al tocar una parada llama a onStopPress con su código', async () => {
    const onStopPress = jest.fn();
    await render(<JerezMap height={200} stops={[stop]} onStopPress={onStopPress} />);
    fireEvent.press(screen.getByTestId('press-stops'));
    expect(onStopPress).toHaveBeenCalledWith('42');
  });

  it('la fuente de paradas amplía la zona de toque 16 px por cada lado', async () => {
    await render(<JerezMap height={200} stops={[stop]} />);
    expect(getRecorded().sources.stops.hitbox).toEqual({ top: 16, right: 16, bottom: 16, left: 16 });
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

describe('JerezMap con el mapa sin conexión', () => {
  it('delete switches back to remote: con el mapa descargado usa el estilo local y tras borrarlo vuelve al remoto', async () => {
    setOfflineFs(createFakeFs().fs);
    await downloadOfflineMap(() => {});
    await render(<JerezMap height={200} />);
    await waitFor(() => expect(typeof getRecorded().map.mapStyle).toBe('object'));
    expect(getRecorded().map.mapStyle.glyphs).toBe('file:///doc/map/fonts/{fontstack}/{range}.pbf');
    await act(async () => {
      await deleteOfflineMap();
    });
    await waitFor(() => expect(getRecorded().map.mapStyle).toBe(MAP_STYLE_URL));
  });

  it('si el mapa descargado está corrupto, usa el remoto', async () => {
    const { fs, files } = createFakeFs();
    setOfflineFs(fs);
    await downloadOfflineMap(() => {});
    files.set('map/style.json', 'esto no es JSON');
    // El archivo existe pero no se puede interpretar: tamaño distinto => no descargado => remoto.
    await useOfflineMap.getState().refresh();
    await render(<JerezMap height={200} />);
    expect(getRecorded().map.mapStyle).toBe(MAP_STYLE_URL);
  });

  it('el fondo liso manda sobre el estilo local', async () => {
    setOfflineFs(createFakeFs().fs);
    await downloadOfflineMap(() => {});
    await render(<JerezMap height={200} />);
    await waitFor(() => expect(typeof getRecorded().map.mapStyle).toBe('object'));
    await act(async () => failMapLoading());
    expect(getRecorded().map.mapStyle.layers[0].type).toBe('background');
    expect(getRecorded().map.mapStyle.glyphs).toBeUndefined();
  });

  describe('recenterKey', () => {
    it('no mueve la cámara en el primer pintado', async () => {
      await render(<JerezMap height={200} center={[-6.13, 36.68]} recenterKey={0} />);
      expect(getRecorded().cameraCalls).toEqual([]);
    });

    it('al cambiar, vuela al centro indicado', async () => {
      const view = await render(<JerezMap height={200} center={[-6.13, 36.68]} zoom={15} recenterKey={0} />);
      await view.rerender(<JerezMap height={200} center={[-6.13, 36.68]} zoom={15} recenterKey={1} />);
      expect(getRecorded().cameraCalls).toEqual([{ method: 'flyTo', args: [{ center: [-6.13, 36.68], zoom: 15 }] }]);
    });

    it('al cambiar, encuadra los límites si se dan', async () => {
      const bounds: [number, number, number, number] = [-6.2, 36.6, -6.1, 36.7];
      const view = await render(<JerezMap height={200} bounds={bounds} recenterKey={0} />);
      await view.rerender(<JerezMap height={200} bounds={bounds} recenterKey={1} />);
      const calls = getRecorded().cameraCalls;
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe('fitBounds');
      expect(calls[0].args[0]).toEqual(bounds);
    });

    it('sin recenterKey, nada se mueve aunque cambie la vista', async () => {
      const view = await render(<JerezMap height={200} center={[-6.13, 36.68]} />);
      await view.rerender(<JerezMap height={200} center={[-6.14, 36.69]} />);
      expect(getRecorded().cameraCalls).toEqual([]);
    });
  });
});
