// Mapa de Jerez sin conexión: descarga el estilo, las teselas y las tipografías al móvil,
// comprueba que la descarga está completa y permite borrarla. También guarda en un pequeño store
// si el mapa está descargado, para que el mapa y Opciones se enteren al momento.
// El sistema de archivos se puede cambiar (setOfflineFs) para probarlo sin tocar el disco real.
import { create } from 'zustand';

import { buildLocalStyle } from './localStyle';
import { MAP_STYLE_URL } from './mapLayers';

// Dirección de la carpeta publicada (la del estilo, sin el nombre del archivo).
const MAP_BASE_URL = MAP_STYLE_URL.replace(/\/style\.json$/, '');

// Tamaño aproximado de la descarga (MB), para avisar antes de descargar. No se pregunta a la red.
export const OFFLINE_MAP_APPROX_MB = 4;

// Las tipografías que el servidor publica: dos estilos (normal y negrita) y tres rangos de caracteres cada uno.
export const FONT_FILES = [
  'Noto Sans Regular/0-255.pbf',
  'Noto Sans Regular/256-511.pbf',
  'Noto Sans Regular/8192-8447.pbf',
  'Noto Sans Bold/0-255.pbf',
  'Noto Sans Bold/256-511.pbf',
  'Noto Sans Bold/8192-8447.pbf',
];

const MAP_DIR = 'map';
const TMP_DIR = 'map-tmp';
const MANIFEST = 'manifest.json';
const STYLE_FILE = 'style.json';
const TILES_FILE = 'jerez.pmtiles';

// Tamaño mínimo (512 KB) que debe tener el archivo de teselas. Si la descarga "funciona" pero devuelve
// una página de error pequeña (por ejemplo un 404 de GitHub Pages), no la damos por buena.
const MIN_TILES_BYTES = 512 * 1024;

/** Lo que necesitamos del sistema de archivos. Las rutas son relativas a la carpeta de datos de la app. */
export interface OfflineFs {
  /** Dirección (URI) de la carpeta de datos de la app, sin barra final. */
  baseUri(): string;
  /** Crea una carpeta (y las que falten por el camino). */
  mkdir(dir: string): void;
  /** Borra una carpeta entera; no da error si no existe. */
  rmdir(dir: string): void;
  /** Cambia el nombre de una carpeta. */
  renameDir(from: string, to: string): void;
  /** Descarga `url` al archivo `path`. */
  download(url: string, path: string): Promise<void>;
  writeText(path: string, content: string): Promise<void>;
  /** Texto del archivo, o null si no existe. */
  readText(path: string): Promise<string | null>;
  /** Tamaño del archivo en bytes, o null si no existe. */
  size(path: string): number | null;
}

// Sistema de archivos real (expo-file-system). Se carga al usarlo para que las pruebas no lo necesiten.
function createRealFs(): OfflineFs {
  const { Directory, File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  return {
    baseUri: () => Paths.document.uri.replace(/\/+$/, ''),
    mkdir: (dir) => new Directory(Paths.document, dir).create({ intermediates: true, idempotent: true }),
    rmdir: (dir) => {
      const d = new Directory(Paths.document, dir);
      if (d.exists) d.delete();
    },
    renameDir: (from, to) => new Directory(Paths.document, from).rename(to),
    download: async (url, path) => {
      const file = new File(Paths.document, path);
      file.parentDirectory.create({ intermediates: true, idempotent: true });
      await File.downloadFileAsync(url, file, { idempotent: true });
    },
    writeText: async (path, content) => {
      const file = new File(Paths.document, path);
      file.parentDirectory.create({ intermediates: true, idempotent: true });
      if (!file.exists) file.create();
      await file.write(content);
    },
    readText: async (path) => {
      const file = new File(Paths.document, path);
      return file.exists ? await file.text() : null;
    },
    size: (path) => {
      const file = new File(Paths.document, path);
      return file.exists ? file.size : null;
    },
  };
}

let currentFs: OfflineFs | null = null;
function fs(): OfflineFs {
  currentFs ??= createRealFs();
  return currentFs;
}

/** Solo para pruebas: cambia el sistema de archivos (null vuelve al real). */
export function setOfflineFs(next: OfflineFs | null) {
  currentFs = next;
}

export type OfflineStatus = { downloaded: boolean; bytes: number };
const NOT_DOWNLOADED: OfflineStatus = { downloaded: false, bytes: 0 };

type Manifest = { files: { path: string; bytes: number }[] };

/**
 * Dice si el mapa está descargado. Solo da `downloaded: true` si existe el manifiesto y todos sus
 * archivos están con el tamaño apuntado; cualquier otra cosa (o error) cuenta como no descargado.
 */
export async function getOfflineStatus(): Promise<OfflineStatus> {
  try {
    const raw = await fs().readText(`${MAP_DIR}/${MANIFEST}`);
    if (!raw) return NOT_DOWNLOADED;
    const manifest = JSON.parse(raw) as Manifest;
    if (!Array.isArray(manifest.files) || manifest.files.length === 0) return NOT_DOWNLOADED;
    let bytes = 0;
    for (const f of manifest.files) {
      if (fs().size(`${MAP_DIR}/${f.path}`) !== f.bytes) return NOT_DOWNLOADED;
      bytes += f.bytes;
    }
    return { downloaded: true, bytes };
  } catch {
    return NOT_DOWNLOADED;
  }
}

// Store con el estado actual del mapa descargado. `refresh` vuelve a mirar el disco.
// `downloading` (progreso) y `error` viven aquí, y no en la pantalla, para que Opciones
// muestre la descarga real aunque se salga de la pantalla y se vuelva a entrar.
type OfflineMapState = {
  status: OfflineStatus;
  /** Progreso de la descarga en marcha, o null si no hay ninguna. */
  downloading: { done: number; total: number } | null;
  /** true si la última descarga falló. */
  error: boolean;
  refresh: () => Promise<void>;
};
export const useOfflineMap = create<OfflineMapState>()((set) => ({
  status: NOT_DOWNLOADED,
  downloading: null,
  error: false,
  refresh: async () => set({ status: await getOfflineStatus() }),
}));

// Descarga en marcha (si la hay). Sirve para que una segunda petición no pise la primera.
let inFlight: Promise<void> | null = null;

/**
 * Descarga el mapa entero. Si ya hay una descarga en marcha, devuelve esa misma (no empieza otra):
 * dos descargas a la vez compartirían la carpeta temporal y se estropearían entre sí.
 * El progreso y el error se apuntan también en el store. Todo va a una carpeta temporal y solo al final se le cambia el nombre a `map/`,
 * de una vez: si algo falla (o la app se cierra), nunca queda un mapa a medias. Si falla, borra lo
 * descargado y relanza el error.
 */
export function downloadOfflineMap(onProgress: (done: number, total: number) => void = () => {}): Promise<void> {
  if (inFlight) return inFlight;
  useOfflineMap.setState({ downloading: { done: 0, total: 0 }, error: false });
  inFlight = runDownload((done, total) => {
    useOfflineMap.setState({ downloading: { done, total } });
    onProgress(done, total);
  })
    .then(
      () => useOfflineMap.setState({ downloading: null }),
      (error) => {
        useOfflineMap.setState({ downloading: null, error: true });
        throw error;
      },
    )
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

// La descarga en sí; downloadOfflineMap se encarga de que solo haya una a la vez.
async function runDownload(onProgress: (done: number, total: number) => void): Promise<void> {
  const f = fs();
  // Archivos a bajar: [ruta en el móvil, dirección en la web].
  const jobs: [string, string][] = [
    [STYLE_FILE, `${MAP_BASE_URL}/${STYLE_FILE}`],
    [TILES_FILE, `${MAP_BASE_URL}/${TILES_FILE}`],
    ...FONT_FILES.map((p): [string, string] => [
      `fonts/${p}`,
      // El nombre de la tipografía lleva espacios: en la dirección web van codificados.
      `${MAP_BASE_URL}/fonts/${p.split('/').map(encodeURIComponent).join('/')}`,
    ]),
  ];
  const total = jobs.length;
  try {
    f.rmdir(TMP_DIR); // restos de una descarga anterior interrumpida
    f.mkdir(TMP_DIR);
    onProgress(0, total);
    let done = 0;
    for (const [path, url] of jobs) {
      await f.download(url, `${TMP_DIR}/${path}`);
      done += 1;
      onProgress(done, total);
    }
    // Estilo local: el remoto con las direcciones apuntando a la carpeta final `map/`.
    const remoteText = await f.readText(`${TMP_DIR}/${STYLE_FILE}`);
    if (!remoteText) throw new Error('No se pudo leer el estilo descargado');
    const local = buildLocalStyle(JSON.parse(remoteText), `${f.baseUri()}/${MAP_DIR}`);
    await f.writeText(`${TMP_DIR}/${STYLE_FILE}`, JSON.stringify(local));
    // Manifiesto: lista de archivos con su tamaño. Se escribe el último.
    const files = jobs.map(([path]) => {
      const bytes = f.size(`${TMP_DIR}/${path}`);
      if (bytes === null || bytes <= 0) throw new Error(`Descarga incompleta: ${path}`);
      if (path === TILES_FILE && bytes < MIN_TILES_BYTES) throw new Error(`Descarga incompleta: ${path} es demasiado pequeño`);
      return { path, bytes };
    });
    await f.writeText(`${TMP_DIR}/${MANIFEST}`, JSON.stringify({ files } satisfies Manifest));
    // Cambio de golpe: fuera el mapa anterior, y la carpeta temporal pasa a ser `map/`.
    f.rmdir(MAP_DIR);
    f.renameDir(TMP_DIR, MAP_DIR);
  } catch (error) {
    try {
      f.rmdir(TMP_DIR);
    } catch {
      // Si ni siquiera se puede borrar, mostramos el error original.
    }
    throw error;
  } finally {
    await useOfflineMap.getState().refresh();
  }
}

/** Borra el mapa descargado; el mapa vuelve al remoto. No hace nada mientras se está descargando. */
export async function deleteOfflineMap(): Promise<void> {
  if (inFlight) return;
  try {
    fs().rmdir(MAP_DIR);
    fs().rmdir(TMP_DIR);
  } finally {
    await useOfflineMap.getState().refresh();
  }
}

/** Lee del móvil el estilo ya convertido; null si no se puede (entonces se usa el remoto). */
export async function readLocalStyle(): Promise<object | null> {
  try {
    const raw = await fs().readText(`${MAP_DIR}/${STYLE_FILE}`);
    return raw ? (JSON.parse(raw) as object) : null;
  } catch {
    return null;
  }
}
