// Posición del móvil: pide el permiso de ubicación y, si se concede, va siguiendo la posición.
// El GPS no necesita internet. Devuelve el estado para que la pantalla explique qué pasa.
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export type LocationStatus = 'asking' | 'denied' | 'blocked' | 'waiting' | 'ready' | 'unavailable' | 'nosignal';

export interface UseLocationResult {
  status: LocationStatus;
  coords: { lat: number; lon: number } | null;
  /** Margen de error de la posición en metros (null si aún no hay posición o el móvil no lo dice). */
  accuracy: number | null;
  /** true si el usuario solo ha dado permiso de ubicación aproximada (Android). */
  coarse: boolean;
  /** Vuelve a pedir el permiso (para el botón "Permitir ubicación"). */
  retry: () => void;
}

// Si pasan 20 segundos buscando y no llega ninguna posición, se avisa de que no hay señal.
const NO_SIGNAL_MS = 20_000;

export function useLocation(): UseLocationResult {
  const [status, setStatus] = useState<LocationStatus>('asking');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [coarse, setCoarse] = useState(false);
  // Cada vez que cambia este número, el efecto de abajo vuelve a empezar desde cero.
  const [attempt, setAttempt] = useState(0);
  // Copia del estado siempre al día, para leerla desde el aviso de AppState sin recrearlo.
  const statusRef = useRef<LocationStatus>('asking');
  statusRef.current = status;

  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stopTimer = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };

    // Al empezar de nuevo (por ejemplo con "reintentar") se olvida la posición anterior.
    setCoords(null);
    setAccuracy(null);
    setCoarse(false);
    setStatus('asking');

    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (!permission.granted) {
          // Si Android ya no deja volver a preguntar, solo se puede arreglar desde los ajustes.
          setStatus(permission.canAskAgain ? 'denied' : 'blocked');
          return;
        }
        setCoarse(permission.android?.accuracy === 'coarse');
        setStatus('waiting');
        // Si no llega ninguna posición en 20 s, se deja de decir "Buscando…" y se avisa.
        timer = setTimeout(() => {
          if (!cancelled) setStatus('nosignal');
        }, NO_SIGNAL_MS);
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 25 },
          (position) => {
            if (cancelled) return;
            stopTimer();
            setCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
            setAccuracy(position.coords.accuracy ?? null);
            setStatus('ready');
          },
          // Si el sistema falla mientras seguimos la posición, no nos quedamos esperando.
          (message) => {
            if (__DEV__) console.warn('Error al seguir la ubicación', message);
            stopTimer();
            if (!cancelled) setStatus('unavailable');
          },
        );
        // Si la pantalla se cerró mientras esperábamos, se libera la suscripción al momento.
        if (cancelled) sub.remove();
        else subscription = sub;
      } catch (error) {
        // Ubicación del móvil apagada o error del sistema: se avisa en vez de quedarse esperando.
        if (__DEV__) console.warn('No se pudo obtener la ubicación', error);
        stopTimer();
        if (!cancelled) setStatus('unavailable');
      }
    })();

    return () => {
      cancelled = true;
      stopTimer();
      subscription?.remove();
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Al volver a la app (por ejemplo desde los ajustes del móvil) se vuelve a mirar si ya hay permiso.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const current = statusRef.current;
      const failed = current === 'unavailable' || current === 'nosignal';
      if (!failed && current !== 'blocked' && current !== 'denied') return;
      Location.getForegroundPermissionsAsync()
        .then((permission) => {
          if (permission.granted || failed) retry();
        })
        // Si no se puede consultar el permiso, solo se reintenta cuando el fallo era de señal.
        .catch(() => {
          if (failed) retry();
        });
    });
    return () => sub.remove();
  }, [retry]);

  return { status, coords, accuracy, coarse, retry };
}
