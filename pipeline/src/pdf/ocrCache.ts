/**
 * Caché del OCR: leer los 57 PDF con OCR tarda unos 20 minutos, así que el resultado de cada PDF se guarda
 * (publicado en `ocr.json`) y solo se vuelve a leer si el PDF ha cambiado.
 * También aquí: las comprobaciones HEAD, la descarga del PDF y la lectura de la caché ya publicada.
 */
import { createHash } from 'node:crypto';
import { USER_AGENT } from '../http';
import type { ParsedPdf } from './parsePage';
import type { PdfSource } from './sources';

/** Lo que se guarda de un PDF ya leído. */
export interface CachedPdf {
  file: string;
  /** Cabecera `Last-Modified` del PDF cuando se leyó (null si no la daba). */
  lastModified: string | null;
  /** Cabecera `Content-Length` del PDF cuando se leyó. */
  contentLength: string | null;
  /** Huella del contenido del PDF: sirve para saber si un archivo manual es de este PDF. */
  sha256: string;
  result: ParsedPdf;
}

/** El contenido de `ocr.json`: un resultado por nombre de archivo. */
export type OcrCacheFile = Record<string, CachedPdf>;

export interface HeadInfo {
  lastModified: string | null;
  contentLength: string | null;
}

export const PUBLISHED_OCR_URL = 'https://sbn998.github.io/buses-jerez/ocr.json';

export type OcrDecision = 'reuse' | 'manual' | 'ocr' | { error: string };

/**
 * Qué hacer con un PDF:
 *  - `manual`: hay una entrada en ocr-manual.json (main comprueba después de descargar que su sha256 coincide).
 *  - `reuse`: las cabeceras HEAD son las mismas que cuando se leyó, o el HEAD ha fallado y hay caché (main avisa).
 *  - `{ error }`: el HEAD ha fallado y no hay caché.
 *  - `ocr`: en los demás casos (PDF nuevo o cambiado).
 */
export function decide(
  source: PdfSource,
  head: HeadInfo | null,
  cached?: CachedPdf,
  manual?: CachedPdf,
): OcrDecision {
  if (manual) return 'manual';
  if (!head) {
    return cached ? 'reuse' : { error: `${source.file}: HEAD failed and there is no cached result` };
  }
  // Si el servidor no da ninguna cabecera no se puede saber si cambió: se vuelve a leer.
  const hasHeaders = head.lastModified !== null || head.contentLength !== null;
  if (
    cached &&
    hasHeaders &&
    cached.lastModified === head.lastModified &&
    cached.contentLength === head.contentLength
  ) {
    return 'reuse';
  }
  return 'ocr';
}

export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Pide solo las cabeceras del PDF. Devuelve null si falla (sin conexión, error del servidor). */
export async function headPdf(url: string, fetchImpl: typeof fetch = fetch): Promise<HeadInfo | null> {
  try {
    const res = await fetchImpl(url, { method: 'HEAD', headers: { 'user-agent': USER_AGENT } });
    if (!res.ok) return null;
    return { lastModified: res.headers.get('last-modified'), contentLength: res.headers.get('content-length') };
  } catch {
    return null;
  }
}

/** Descarga un PDF (3 intentos). Devuelve los bytes y sus cabeceras. */
export async function downloadPdf(
  url: string,
  fetchImpl: typeof fetch = fetch,
  retryDelaysMs = [2000, 4000],
): Promise<{ bytes: Uint8Array; head: HeadInfo }> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, retryDelaysMs[attempt - 1]));
    try {
      const res = await fetchImpl(url, { headers: { 'user-agent': USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return {
        bytes: new Uint8Array(await res.arrayBuffer()),
        head: { lastModified: res.headers.get('last-modified'), contentLength: res.headers.get('content-length') },
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Fallo al descargar ${url}: ${String(lastError)}`);
}

export type PreviousOcrResult = { ok: true; cache: OcrCacheFile } | { ok: false; error: string };

/**
 * Descarga el `ocr.json` publicado la última vez. 404 = todavía no hay (caché vacía).
 * Cualquier otro fallo es un error (no se sabría qué PDF hay que releer).
 */
export async function fetchPreviousOcr(fetchImpl: typeof fetch = fetch): Promise<PreviousOcrResult> {
  try {
    const res = await fetchImpl(PUBLISHED_OCR_URL);
    if (res.status === 404) return { ok: true, cache: {} };
    if (!res.ok) return { ok: false, error: `previous ocr.json HTTP ${res.status}` };
    return { ok: true, cache: JSON.parse(await res.text()) as OcrCacheFile };
  } catch (err) {
    return { ok: false, error: `previous ocr.json not available (${String(err)})` };
  }
}
