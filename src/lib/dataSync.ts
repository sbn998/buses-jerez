// Lógica pura de los datos sin conexión: leer lo guardado, elegir entre lo descargado y la copia
// incluida, y comprobar si hay datos nuevos. No toca el disco ni la red directamente: recibe esas
// funciones desde fuera (así se puede probar con versiones falsas).
import { SCHEMA_VERSION, type Dataset, type Manifest } from '@/data/schema';

/** Dirección donde se publican los datos. */
export const BASE_URL = 'https://sbn998.github.io/buses-jerez/';

/** Lo que guardamos en el móvil: los datos descargados, su versión y cuándo se comprobó por última vez. */
export interface Stored {
  version: string;
  checkedAt: string;
  data: Dataset;
}

export interface PickedData {
  data: Dataset;
  source: 'downloaded' | 'bundled';
  checkedAt: string | null;
}

/** Funciones externas que necesita syncData (red, disco y reloj). */
export interface SyncDeps {
  fetchText(url: string): Promise<string>;
  readStored(): Promise<string | null>;
  writeStored(json: string): Promise<void>;
  now(): Date;
}

/** Aviso en consola solo en desarrollo (en la app publicada no se muestra nada). */
export function warnDev(message: string, error: unknown): void {
  if (__DEV__) console.warn(message, error);
}

/** Comprueba la forma mínima de los datos: sin esto, un archivo a medias podría romper la app en cada arranque. */
export function isDataset(x: unknown): x is Dataset {
  if (!x || typeof x !== 'object') return false;
  const d = x as Partial<Dataset>;
  return (
    d.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(d.lines) &&
    !!d.stops &&
    typeof d.stops === 'object' &&
    Array.isArray(d.holidays)
  );
}

/** Convierte el texto guardado en datos. Devuelve null si está vacío, roto o es de un formato que no entendemos. */
export function parseStored(json: string | null): Stored | null {
  if (!json) return null;
  try {
    const s = JSON.parse(json) as Stored;
    if (!s || typeof s.version !== 'string' || typeof s.checkedAt !== 'string') return null;
    if (!isDataset(s.data)) return null;
    return s;
  } catch (e) {
    warnDev('Datos guardados ilegibles, se ignoran:', e);
    return null;
  }
}

/** Usa los datos descargados si los hay; si no, la copia incluida en la app. */
export function pickDataset(stored: Stored | null, bundled: Dataset): PickedData {
  if (stored) return { data: stored.data, source: 'downloaded', checkedAt: stored.checkedAt };
  return { data: bundled, source: 'bundled', checkedAt: null };
}

/**
 * Comprueba si hay datos nuevos. Devuelve lo que debe quedar guardado (o `current` si no cambia nada).
 * Ante cualquier fallo (sin conexión, datos raros) no toca nada y devuelve `current`.
 */
export async function syncData(deps: SyncDeps, current: Stored | null): Promise<Stored | null> {
  try {
    const manifest = JSON.parse(await deps.fetchText(BASE_URL + 'manifest.json')) as Manifest;
    if (!manifest || manifest.schemaVersion !== SCHEMA_VERSION || typeof manifest.version !== 'string') return current;
    const checkedAt = deps.now().toISOString();
    // Misma versión: solo apuntamos que hemos comprobado hoy.
    if (current && current.version === manifest.version) {
      const updated: Stored = { ...current, checkedAt };
      await deps.writeStored(JSON.stringify(updated));
      return updated;
    }
    // Versión distinta: descargamos los datos completos y comprobamos su formato.
    const data: unknown = JSON.parse(await deps.fetchText(BASE_URL + manifest.dataUrl));
    if (!isDataset(data)) return current;
    const updated: Stored = { version: manifest.version, checkedAt, data };
    await deps.writeStored(JSON.stringify(updated));
    return updated;
  } catch (e) {
    warnDev('No se pudieron actualizar los datos, se usan los que hay:', e);
    return current;
  }
}
