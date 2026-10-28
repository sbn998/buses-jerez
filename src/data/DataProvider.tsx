// Proveedor de datos de la app: muestra al momento lo guardado (o la copia incluida) y, en segundo
// plano, comprueba si hay datos nuevos. Las pantallas leen los datos con useData().
import { File, Paths } from 'expo-file-system';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { parseStored, pickDataset, syncData, type PickedData, type Stored } from '@/lib/dataSync';
import bundledJson from './bundled.json';
import type { Dataset } from './schema';

const bundled = bundledJson as unknown as Dataset;

const DataContext = createContext<PickedData | null>(null);

// Archivo donde se guardan los datos descargados.
function cacheFile() {
  return new File(Paths.document, 'data-cache.json');
}

async function readStored(): Promise<string | null> {
  try {
    const f = cacheFile();
    return f.exists ? await f.text() : null;
  } catch {
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

  useEffect(() => {
    if (value) return;
    let cancelled = false;
    (async () => {
      const fromDisk = parseStored(await readStored());
      if (cancelled) return;
      setStored(fromDisk);
      // Comprobación en segundo plano; si hay datos nuevos, la pantalla se actualiza sola.
      const synced = await syncData({ fetchText, readStored, writeStored, now: () => new Date() }, fromDisk);
      if (!cancelled) setStored(synced);
    })();
    return () => {
      cancelled = true;
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
