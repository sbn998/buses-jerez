// Proveedor de datos de la app: muestra al momento lo guardado (o la copia incluida) y, en segundo
// plano, comprueba si hay datos nuevos. Las pantallas leen los datos con useData().
import { File, Paths } from 'expo-file-system';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { parseStored, pickDataset, syncData, warnDev, type PickedData, type Stored } from '@/lib/dataSync';
import bundledJson from './bundled.json';
import type { Dataset } from './schema';

const bundled = bundledJson as unknown as Dataset;

// Si la última comprobación es más antigua que esto, al volver a la app se busca de nuevo.
const RECHECK_AFTER_MS = 12 * 60 * 60 * 1000;

const DataContext = createContext<PickedData | null>(null);

// Archivo donde se guardan los datos descargados.
function cacheFile() {
  return new File(Paths.document, 'data-cache.json');
}

async function readStored(): Promise<string | null> {
  try {
    const f = cacheFile();
    return f.exists ? await f.text() : null;
  } catch (e) {
    warnDev('No se pudo leer el archivo de datos guardado:', e);
    return null;
  }
}

async function writeStored(json: string): Promise<void> {
  const f = cacheFile();
  if (!f.exists) f.create();
  f.write(json);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

interface Props {
  children: ReactNode;
  /** Solo para pruebas: si se da, se usa directamente sin cargar ni descargar nada. */
  value?: PickedData;
}

export function DataProvider({ children, value }: Props) {
  const [stored, setStored] = useState<Stored | null>(null);
  // Copia de `stored` que siempre está al día, para leerla desde el aviso de AppState sin recrearlo.
  const storedRef = useRef<Stored | null>(null);
  // Indica que ya hay una comprobación en marcha, para no lanzar dos a la vez.
  const syncing = useRef(false);

  useEffect(() => {
    if (value) return;
    let cancelled = false;

    // Comprueba si hay datos nuevos (sin molestar si ya hay otra comprobación en curso).
    async function runSync(from: Stored | null) {
      if (syncing.current) return;
      syncing.current = true;
      try {
        const synced = await syncData({ fetchText, readStored, writeStored, now: () => new Date() }, from);
        if (!cancelled) {
          storedRef.current = synced;
          setStored(synced);
        }
      } catch (e) {
        warnDev('Fallo inesperado al comprobar datos nuevos:', e);
      } finally {
        syncing.current = false;
      }
    }

    (async () => {
      const fromDisk = parseStored(await readStored());
      if (cancelled) return;
      storedRef.current = fromDisk;
      setStored(fromDisk);
      // Comprobación en segundo plano; si hay datos nuevos, la pantalla se actualiza sola.
      await runSync(fromDisk);
    })();

    // Al volver a la app, si hace más de 12 h que no se comprueba (o nunca), se busca de nuevo.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const current = storedRef.current;
      const checkedAt = current ? Date.parse(current.checkedAt) : NaN;
      if (Number.isNaN(checkedAt) || Date.now() - checkedAt > RECHECK_AFTER_MS) void runSync(current);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [value]);

  return <DataContext.Provider value={value ?? pickDataset(stored, bundled)}>{children}</DataContext.Provider>;
}

/** Datos actuales (descargados o copia incluida), con su origen y la fecha de última comprobación. */
export function useData(): PickedData {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de DataProvider');
  return ctx;
}
