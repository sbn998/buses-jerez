// Reloj de la app: devuelve la hora actual y la renueva justo al cambiar de minuto
// (así "en N min" nunca va retrasado) y cuando la app vuelve del segundo plano.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    // El primer aviso llega al empezar el siguiente minuto; después, cada 60 s.
    const first = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    // Al volver a la app puede haber pasado mucho tiempo: se refresca al momento.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => {
      clearTimeout(first);
      if (interval) clearInterval(interval);
      sub.remove();
    };
  }, []);

  return now;
}
