// Posición del móvil: pide el permiso de ubicación y, si se concede, va siguiendo la posición.
// El GPS no necesita internet. Devuelve el estado para que la pantalla explique qué pasa.
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

export type LocationStatus = 'asking' | 'denied' | 'blocked' | 'waiting' | 'ready' | 'unavailable';

export interface UseLocationResult {
  status: LocationStatus;
  coords: { lat: number; lon: number } | null;
  /** Vuelve a pedir el permiso (para el botón "Permitir ubicación"). */
  retry: () => void;
}

export function useLocation(): UseLocationResult {
  const [status, setStatus] = useState<LocationStatus>('asking');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  // Cada vez que cambia este número, el efecto de abajo vuelve a empezar desde cero.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    // Al empezar de nuevo (por ejemplo con "reintentar") se olvida la posición anterior.
    setCoords(null);
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
        setStatus('waiting');
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 25 },
          (position) => {
            if (cancelled) return;
            setCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
            setStatus('ready');
          },
        );
        // Si la pantalla se cerró mientras esperábamos, se libera la suscripción al momento.
        if (cancelled) sub.remove();
        else subscription = sub;
      } catch (error) {
        // Ubicación del móvil apagada o error del sistema: se avisa en vez de quedarse esperando.
        if (__DEV__) console.warn('No se pudo obtener la ubicación', error);
        if (!cancelled) setStatus('unavailable');
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { status, coords, retry };
}
