/**
 * Descarga la versión de los datos publicada la última vez, para comparar con ella
 * (por ejemplo, para detectar que de repente faltan muchas horas).
 *
 * - Si la web responde 404, todavía no se ha publicado nada (primera vez): se
 *   sigue sin comparar.
 * - Cualquier otro fallo (sin conexión, error del servidor, archivo roto) se trata
 *   como error: sin la versión anterior no se puede comprobar que los datos nuevos
 *   no hayan empeorado, así que es más seguro no publicar ese día.
 */
import type { Dataset } from '../../src/data/schema';

export const PUBLISHED_DATA_URL = 'https://sbn998.github.io/buses-jerez/data.json';

export type PreviousResult = { ok: true; previous: Dataset | null } | { ok: false; error: string };

export async function fetchPrevious(fetchImpl: typeof fetch = fetch): Promise<PreviousResult> {
  try {
    const res = await fetchImpl(PUBLISHED_DATA_URL);
    if (res.status === 404) return { ok: true, previous: null };
    if (!res.ok) return { ok: false, error: `previous dataset HTTP ${res.status}` };
    return { ok: true, previous: JSON.parse(await res.text()) as Dataset };
  } catch (err) {
    return { ok: false, error: `previous dataset not available (${String(err)})` };
  }
}
