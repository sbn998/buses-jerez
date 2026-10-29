// Pruebas del hook useLocation con expo-location simulado: permisos y primera posición.
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useLocation } from '../use-location';

const mockRequest = jest.fn();
const mockWatch = jest.fn();
const mockGetPermission = jest.fn();
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, High: 4 },
  getForegroundPermissionsAsync: () => mockGetPermission(),
  requestForegroundPermissionsAsync: () => mockRequest(),
  watchPositionAsync: (...args: unknown[]) => mockWatch(...args),
}));

beforeEach(() => {
  mockRequest.mockReset();
  mockWatch.mockReset();
  mockGetPermission.mockReset();
});

describe('useLocation', () => {
  it('permiso concedido: waiting y, tras la primera posición, ready con coords', async () => {
    mockRequest.mockResolvedValue({ granted: true, canAskAgain: true });
    let emit: (p: { coords: { latitude: number; longitude: number } }) => void = () => {};
    mockWatch.mockImplementation(async (_opts, cb) => {
      emit = cb;
      return { remove: jest.fn() };
    });
    const { result } = await renderHook(() => useLocation());
    await waitFor(() => expect(result.current.status).toBe('waiting'));
    expect(result.current.coords).toBeNull();
    expect(mockWatch.mock.calls[0][0]).toEqual({ accuracy: 4, distanceInterval: 25 });

    await act(async () => emit({ coords: { latitude: 36.68, longitude: -6.13 } }));
    expect(result.current.status).toBe('ready');
    expect(result.current.coords).toEqual({ lat: 36.68, lon: -6.13 });
  });

  it('permiso denegado con canAskAgain true: denied', async () => {
    mockRequest.mockResolvedValue({ granted: false, canAskAgain: true });
    const { result } = await renderHook(() => useLocation());
    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(mockWatch).not.toHaveBeenCalled();
  });

  it('permiso denegado con canAskAgain false: blocked', async () => {
    mockRequest.mockResolvedValue({ granted: false, canAskAgain: false });
    const { result } = await renderHook(() => useLocation());
    await waitFor(() => expect(result.current.status).toBe('blocked'));
  });

  it('retry vuelve a pedir el permiso', async () => {
    mockRequest.mockResolvedValueOnce({ granted: false, canAskAgain: true });
    const { result } = await renderHook(() => useLocation());
    await waitFor(() => expect(result.current.status).toBe('denied'));

    mockRequest.mockResolvedValue({ granted: true, canAskAgain: true });
    mockWatch.mockResolvedValue({ remove: jest.fn() });
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('waiting'));
  });

  it('al desmontar se llama a remove()', async () => {
    const remove = jest.fn();
    mockRequest.mockResolvedValue({ granted: true, canAskAgain: true });
    mockWatch.mockResolvedValue({ remove });
    const { result, unmount } = await renderHook(() => useLocation());
    await waitFor(() => expect(result.current.status).toBe('waiting'));
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('si pedir el permiso falla: unavailable (y se avisa solo en desarrollo)', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockRequest.mockRejectedValue(new Error('sin servicios de ubicación'));
    const { result } = await renderHook(() => useLocation());
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('si seguir la posición falla: unavailable', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockRequest.mockResolvedValue({ granted: true, canAskAgain: true });
    mockWatch.mockRejectedValue(new Error('GPS apagado'));
    const { result } = await renderHook(() => useLocation());
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    warn.mockRestore();
  });

  it('retry desde unavailable empieza de nuevo y borra la posición anterior', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let emit: (p: { coords: { latitude: number; longitude: number } }) => void = () => {};
    mockRequest.mockResolvedValueOnce({ granted: true, canAskAgain: true });
    mockWatch.mockImplementationOnce(async (_o, cb) => {
      emit = cb;
      return { remove: jest.fn() };
    });
    const { result } = await renderHook(() => useLocation());
    await waitFor(() => expect(result.current.status).toBe('waiting'));
    await act(async () => emit({ coords: { latitude: 1, longitude: 2 } }));
    expect(result.current.coords).toEqual({ lat: 1, lon: 2 });

    // Segundo intento: el permiso falla -> unavailable, y la posición vieja ya no está.
    mockRequest.mockRejectedValueOnce(new Error('fallo'));
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current.coords).toBeNull();

    // Tercer intento desde unavailable: vuelve a empezar.
    mockRequest.mockResolvedValue({ granted: true, canAskAgain: true });
    mockWatch.mockResolvedValue({ remove: jest.fn() });
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('waiting'));
    warn.mockRestore();
  });

  it('si el sistema avisa de un error mientras sigue la posición: unavailable', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let fail: (message: string) => void = () => {};
    mockRequest.mockResolvedValue({ granted: true, canAskAgain: true });
    mockWatch.mockImplementation(async (_o, _cb, onError) => {
      fail = onError;
      return { remove: jest.fn() };
    });
    const { result } = await renderHook(() => useLocation());
    await waitFor(() => expect(result.current.status).toBe('waiting'));
    expect(typeof mockWatch.mock.calls[0][2]).toBe('function');
    await act(async () => fail('GPS roto'));
    expect(result.current.status).toBe('unavailable');
    warn.mockRestore();
  });

  it('guarda la precisión de la posición (metros) y si el permiso es aproximado (Android)', async () => {
    let emit: (p: { coords: { latitude: number; longitude: number; accuracy: number | null } }) => void = () => {};
    mockRequest.mockResolvedValue({ granted: true, canAskAgain: true, android: { accuracy: 'coarse' } });
    mockWatch.mockImplementation(async (_o, cb) => {
      emit = cb;
      return { remove: jest.fn() };
    });
    const { result } = await renderHook(() => useLocation());
    await waitFor(() => expect(result.current.status).toBe('waiting'));
    expect(result.current.accuracy).toBeNull();
    expect(result.current.coarse).toBe(true);
    await act(async () => emit({ coords: { latitude: 1, longitude: 2, accuracy: 480 } }));
    expect(result.current.accuracy).toBe(480);
  });

  describe('sin señal (20 s)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('si no hay posición a los 20 s: nosignal', async () => {
      mockRequest.mockResolvedValue({ granted: true, canAskAgain: true });
      mockWatch.mockResolvedValue({ remove: jest.fn() });
      const { result } = await renderHook(() => useLocation());
      await waitFor(() => expect(result.current.status).toBe('waiting'));
      await act(async () => jest.advanceTimersByTime(19_000));
      expect(result.current.status).toBe('waiting');
      await act(async () => jest.advanceTimersByTime(1_500));
      expect(result.current.status).toBe('nosignal');
    });

    it('si llega una posición antes de 20 s: ready y el estado ya no cambia', async () => {
      let emit: (p: { coords: { latitude: number; longitude: number; accuracy: number } }) => void = () => {};
      mockRequest.mockResolvedValue({ granted: true, canAskAgain: true });
      mockWatch.mockImplementation(async (_o, cb) => {
        emit = cb;
        return { remove: jest.fn() };
      });
      const { result } = await renderHook(() => useLocation());
      await waitFor(() => expect(result.current.status).toBe('waiting'));
      await act(async () => emit({ coords: { latitude: 1, longitude: 2, accuracy: 10 } }));
      expect(result.current.status).toBe('ready');
      await act(async () => jest.advanceTimersByTime(60_000));
      expect(result.current.status).toBe('ready');
    });

    it('al desmontar se cancela el temporizador', async () => {
      mockRequest.mockResolvedValue({ granted: true, canAskAgain: true });
      mockWatch.mockResolvedValue({ remove: jest.fn() });
      // Se anota qué temporizador de 20 s se crea y se comprueba que se cancela al desmontar.
      const created: unknown[] = [];
      const realSetTimeout = global.setTimeout;
      jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
        const id = realSetTimeout(fn, ms);
        if (ms === 20_000) created.push(id);
        return id;
      }) as never);
      const clear = jest.spyOn(global, 'clearTimeout');
      const { result, unmount } = await renderHook(() => useLocation());
      await waitFor(() => expect(result.current.status).toBe('waiting'));
      expect(created).toHaveLength(1);
      await unmount();
      expect(clear).toHaveBeenCalledWith(created[0]);
      jest.restoreAllMocks();
    });

    it('retry cancela el temporizador anterior y empieza otro de cero', async () => {
      mockRequest.mockResolvedValue({ granted: true, canAskAgain: true });
      mockWatch.mockResolvedValue({ remove: jest.fn() });
      const { result } = await renderHook(() => useLocation());
      await waitFor(() => expect(result.current.status).toBe('waiting'));
      await act(async () => jest.advanceTimersByTime(15_000));
      await act(async () => result.current.retry());
      await waitFor(() => expect(result.current.status).toBe('waiting'));
      await act(async () => jest.advanceTimersByTime(15_000));
      expect(result.current.status).toBe('waiting'); // el temporizador viejo (15 s + 15 s) ya no cuenta
    });
  });

  describe('al volver a la app (AppState)', () => {
    let listener: (state: string) => void = () => {};
    const remove = jest.fn();
    beforeEach(() => {
      remove.mockReset();
      jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, cb: (s: string) => void) => {
        listener = cb;
        return { remove };
      }) as never);
    });
    afterEach(() => jest.restoreAllMocks());

    it('blocked y ahora el permiso está concedido: vuelve a empezar', async () => {
      mockRequest.mockResolvedValueOnce({ granted: false, canAskAgain: false });
      const { result } = await renderHook(() => useLocation());
      await waitFor(() => expect(result.current.status).toBe('blocked'));

      mockGetPermission.mockResolvedValue({ granted: true });
      mockRequest.mockResolvedValue({ granted: true, canAskAgain: true });
      mockWatch.mockResolvedValue({ remove: jest.fn() });
      await act(async () => listener('active'));
      await waitFor(() => expect(result.current.status).toBe('waiting'));
    });

    it('blocked y el permiso sigue sin darse: no hace nada', async () => {
      mockRequest.mockResolvedValue({ granted: false, canAskAgain: false });
      const { result } = await renderHook(() => useLocation());
      await waitFor(() => expect(result.current.status).toBe('blocked'));
      mockGetPermission.mockResolvedValue({ granted: false });
      await act(async () => listener('active'));
      expect(result.current.status).toBe('blocked');
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('unavailable: al volver a la app reintenta aunque el permiso no haya cambiado', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockRequest.mockRejectedValueOnce(new Error('GPS apagado'));
      const { result } = await renderHook(() => useLocation());
      await waitFor(() => expect(result.current.status).toBe('unavailable'));

      mockGetPermission.mockResolvedValue({ granted: false });
      mockRequest.mockResolvedValue({ granted: true, canAskAgain: true });
      mockWatch.mockResolvedValue({ remove: jest.fn() });
      await act(async () => listener('active'));
      await waitFor(() => expect(result.current.status).toBe('waiting'));
      warn.mockRestore();
    });

    it('otros estados de la app se ignoran, y al desmontar se quita el aviso', async () => {
      mockRequest.mockResolvedValue({ granted: false, canAskAgain: false });
      const { result, unmount } = await renderHook(() => useLocation());
      await waitFor(() => expect(result.current.status).toBe('blocked'));
      await act(async () => listener('background'));
      expect(mockGetPermission).not.toHaveBeenCalled();
      await unmount();
      expect(remove).toHaveBeenCalledTimes(1);
    });
  });
});
