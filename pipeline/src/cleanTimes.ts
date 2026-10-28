/**
 * Limpieza de horas.
 *
 * Los datos oficiales de Comujesa tienen pequeños fallos:
 * - Horas "de relleno" imposibles, como "00:01" entre las 13:49 y las 15:14.
 *   Ningún autobús urbano de Jerez circula de madrugada, así que toda hora
 *   anterior a las 05:00 se quita.
 * - Horas desordenadas. A veces es un fallo pequeño ("16:30, 15:50"). Otras veces,
 *   el autobús pasa dos veces por la misma parada y Comujesa da primero todas las
 *   horas de una pasada y luego las de la otra. En los dos casos son horas reales:
 *   se conservan todas y se ordenan.
 * - Horas repetidas exactamente: se deja una.
 *
 * Cada corrección se apunta en `issues`, para que aparezca en los avisos del
 * proceso y se pueda revisar.
 */
import type { TimeOfDay } from '../../src/data/schema';

/** Antes de esta hora no hay servicio urbano: una hora así es un relleno. */
const FIRST_SERVICE = '05:00';

export function cleanTimes(times: TimeOfDay[]): { times: TimeOfDay[]; issues: string[] } {
  const issues: string[] = [];
  const kept = times.filter((t) => {
    if (t >= FIRST_SERVICE) return true;
    issues.push(`dropped ${t} (out of sequence)`);
    return false;
  });
  // Las horas "HH:MM" con dos cifras se ordenan bien como texto.
  const sorted = [...kept].sort();
  if (sorted.some((t, i) => t !== kept[i])) issues.push('reordered');
  // Una misma hora repetida no es un segundo autobús: se deja una sola.
  const unique = sorted.filter((t, i) => {
    if (i === 0 || t !== sorted[i - 1]) return true;
    issues.push(`removed duplicate ${t}`);
    return false;
  });
  return { times: unique, issues };
}
