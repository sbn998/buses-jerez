// Reloj de la app: devuelve la hora actual y la renueva justo al cambiar de minuto
// (así "en N min" nunca va retrasado) y cuando la app vuelve del segundo plano.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// Margen para no disparar un instante antes del cambio de minuto.
const MARGEN_MS = 50;

export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Programa el siguiente aviso para el comienzo del próximo minuto. El retraso se
    // recalcula en cada vuelta: así, si Android pausó los temporizadores en segundo
    // plano, el reloj se vuelve a alinear solo (un setInterval arrastraría el desfase).
    const schedule = () => {
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + MARGEN_MS);
    };
    const tick = () => {
      setNow(new Date());
      schedule();
    };
    schedule();

    // Al volver a la app puede haber pasado mucho tiempo: se refresca al momento
    // y se reprograma el aviso desde la hora actual.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setNow(new Date());
      clearTimeout(timer);
      schedule();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return now;
}
