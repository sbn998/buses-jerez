// Pruebas del reloj useNow: se actualiza justo al cambiar de minuto y al volver a la app.
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useNow } from '../use-now';

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useNow', () => {
  it('montado a hh:mm:59 se actualiza 1 s después, no 60 s después', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 28, 10, 5, 59, 0));
    const { result } = await renderHook(() => useNow());
    expect(result.current.getMinutes()).toBe(5);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.getMinutes()).toBe(6);
  });

  it('un evento AppState active refresca la hora', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 28, 10, 5, 10, 0));
    let handler: (s: string) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
      handler = h;
      return { remove };
    }) as never);
    const { result, unmount } = await renderHook(() => useNow());
    // El reloj salta 3 minutos sin que salte ningún temporizador (como al volver del segundo plano).
    jest.setSystemTime(new Date(2026, 9, 28, 10, 8, 10, 0));
    await act(async () => {
      handler('active');
    });
    expect(result.current.getMinutes()).toBe(8);
    await unmount();
    expect(remove).toHaveBeenCalled();
  });
});
