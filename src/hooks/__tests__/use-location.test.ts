// Pruebas del hook useLocation con expo-location simulado: permisos y primera posición.
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useLocation } from '../use-location';

const mockRequest = jest.fn();
const mockWatch = jest.fn();
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: () => mockRequest(),
  watchPositionAsync: (...args: unknown[]) => mockWatch(...args),
}));

beforeEach(() => {
  mockRequest.mockReset();
  mockWatch.mockReset();
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
    expect(mockWatch.mock.calls[0][0]).toEqual({ accuracy: 3, distanceInterval: 25 });

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
});
