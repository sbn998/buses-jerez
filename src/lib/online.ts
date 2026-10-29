// Comprueba si hay conexión a internet de verdad: pide solo la cabecera del manifest de los datos.
// Recibe el fetch desde fuera (así se puede probar con uno falso).
import { BASE_URL } from '@/lib/dataSync';

/** true si el servidor responde bien antes de `timeoutMs`; false si hay error, tiempo agotado o estado no 2xx. */
export async function isOnline(fetchFn: typeof fetch = fetch, timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController();
  // Si pasa el tiempo sin respuesta, cancelamos la petición.
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(BASE_URL + 'manifest.json', {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
