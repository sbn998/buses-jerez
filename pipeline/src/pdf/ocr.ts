/**
 * Lector OCR de los PDF de horarios: convierte la imagen JPEG en una lista de palabras con su posición.
 * Para que la letra diminuta se lea bien, la imagen se amplía ×3 y se pasa a gris con más contraste.
 */
import sharp from 'sharp';
import { createWorker, PSM } from 'tesseract.js';

/** Una palabra leída, con su caja (en píxeles de la imagen ampliada) y la confianza del OCR (0-100). */
export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence: number;
}

/** Resultado de leer una imagen: su tamaño (ya ampliada) y todas las palabras. */
export interface OcrPage {
  width: number;
  height: number;
  words: OcrWord[];
}

/** Cuánto se amplía la imagen antes de leerla (sin ampliar se pierden las horas marcadas). */
const SCALE = 3;

/**
 * Crea un lector que se puede reutilizar para varios PDF (arrancar tesseract es lento).
 * Al terminar hay que llamar a `close()`.
 */
export async function createOcr(): Promise<{
  read(jpeg: Uint8Array): Promise<OcrPage>;
  close(): Promise<void>;
}> {
  const worker = await createWorker('spa');
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    preserve_interword_spaces: '1',
  });

  return {
    async read(jpeg) {
      const meta = await sharp(jpeg).metadata();
      const png = await sharp(jpeg)
        .resize(Math.round((meta.width ?? 0) * SCALE))
        .grayscale()
        .normalise()
        .png()
        .toBuffer();
      const out = await sharp(png).metadata();
      const { data } = await worker.recognize(png, {}, { blocks: true });

      // Recorremos bloques → párrafos → líneas → palabras y nos quedamos con las palabras.
      const words: OcrWord[] = [];
      for (const block of data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            for (const w of line.words) {
              const text = w.text.trim();
              if (!text) continue;
              words.push({
                text,
                x0: Math.round(w.bbox.x0),
                y0: Math.round(w.bbox.y0),
                x1: Math.round(w.bbox.x1),
                y1: Math.round(w.bbox.y1),
                confidence: Math.round(w.confidence),
              });
            }
          }
        }
      }
      return { width: out.width ?? 0, height: out.height ?? 0, words };
    },
    close: async () => {
      await worker.terminate();
    },
  };
}

/** Lee una sola imagen (crea el lector, la lee y lo cierra). */
export async function ocrImage(jpeg: Uint8Array): Promise<OcrPage> {
  const ocr = await createOcr();
  try {
    return await ocr.read(jpeg);
  } finally {
    await ocr.close();
  }
}
