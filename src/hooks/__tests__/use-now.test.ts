// Pruebas del reloj useNow: se actualiza justo al cambiar de minuto y al volver a la app.
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useNow } from '../use-now';

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useNow', () => {
  it('montado a hh:mm:59 se actualiza ~1 s después, no 60 s después', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 28, 10, 5, 59, 0));
    const { result } = await renderHook(() => useNow());
    expect(result.current.getMinutes()).toBe(5);
    await act(async () => {
      // 1 s hasta el minuto + el pequeño margen de seguridad del reloj.
      jest.advanceTimersByTime(1100);
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

  it('tras volver del segundo plano a hh:mm:50 sigue cambiando justo al minuto siguiente', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 28, 10, 13, 10, 0));
    let handler: (s: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
      handler = h;
      return { remove: jest.fn() };
    }) as never);
    const { result } = await renderHook(() => useNow());
    // Android pausa los temporizadores: el reloj salta a 10:13:50 y la app vuelve.
    jest.setSystemTime(new Date(2026, 9, 28, 10, 13, 50, 0));
    await act(async () => {
      handler('active');
    });
    expect(result.current.getMinutes()).toBe(13);
    // Al llegar las 10:14:00 (+100 ms) la hora debe pasar a 10:14, no esperar a las 10:14:50.
    await act(async () => {
      jest.advanceTimersByTime(10_100);
    });
    expect(result.current.getMinutes()).toBe(14);
  });
});
