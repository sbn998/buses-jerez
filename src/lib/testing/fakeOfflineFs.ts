// Sistema de archivos falso en memoria para probar el mapa sin conexión sin tocar el disco.
import type { OfflineFs } from '../offlineMap';

export const FAKE_BASE = 'file:///doc';

// Estilo remoto de ejemplo, con las dos direcciones que se convierten.
export const REMOTE_STYLE = {
  version: 8,
  sources: { openmaptiles: { type: 'vector', url: 'pmtiles://https://x/map/jerez.pmtiles' } },
  glyphs: 'https://x/map/fonts/{fontstack}/{range}.pbf',
  layers: [],
};

/**
 * Crea el disco falso. `failOnDownload` es el número de descarga (empezando en 1) que debe fallar.
 * `files` guarda el contenido de cada archivo por ruta; `urls` apunta lo descargado.
 */
export function createFakeFs(opts: { failOnDownload?: number } = {}) {
  const files = new Map<string, string>();
  const urls: string[] = [];
  const fs: OfflineFs = {
    baseUri: () => FAKE_BASE,
    mkdir: () => {},
    rmdir: (dir) => {
      for (const key of [...files.keys()]) if (key.startsWith(`${dir}/`)) files.delete(key);
    },
    renameDir: (from, to) => {
      for (const [key, value] of [...files.entries()]) {
        if (key.startsWith(`${from}/`)) {
          files.delete(key);
          files.set(`${to}/${key.slice(from.length + 1)}`, value);
        }
      }
    },
    download: async (url, path) => {
      urls.push(url);
      if (urls.length === opts.failOnDownload) throw new Error('sin red');
      files.set(path, url.endsWith('style.json') ? JSON.stringify(REMOTE_STYLE) : 'x'.repeat(100));
    },
    writeText: async (path, content) => {
      files.set(path, content);
    },
    readText: async (path) => files.get(path) ?? null,
    size: (path) => (files.has(path) ? files.get(path)!.length : null),
  };
  return { fs, files, urls };
}
