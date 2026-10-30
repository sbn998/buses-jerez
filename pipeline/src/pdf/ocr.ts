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

/** Ampliación máxima (sin ampliar se pierden las horas marcadas). */
const MAX_SCALE = 3;

/** Tamaño máximo de la imagen ampliada (40 megapíxeles): más grande, el OCR se queda sin memoria. */
export const MAX_OCR_PIXELS = 40_000_000;

/** Cuánto ampliar una imagen: ×3, o menos si pasaría de 40 megapíxeles. */
export function ocrScale(width: number, height: number): number {
  return Math.min(MAX_SCALE, Math.sqrt(MAX_OCR_PIXELS / (width * height)));
}

/** Parte de arriba de la imagen que se lee una segunda vez (donde están las fechas de validez). */
const HEADER_BAND = 0.2;

/** Dos palabras "son la misma" si sus cajas se solapan en más de la mitad de la más pequeña. */
function overlaps(a: OcrWord, b: OcrWord): boolean {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (w <= 0 || h <= 0) return false;
  const smaller = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
  return w * h > smaller / 2;
}

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

  /** Lee una imagen y devuelve sus palabras (recorre bloques, párrafos y líneas). */
  async function readWords(image: Buffer): Promise<OcrWord[]> {
    const { data } = await worker.recognize(image, {}, { blocks: true });
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
    return words;
  }

  return {
    async read(jpeg) {
      const meta = await sharp(jpeg).metadata();
      const png = await sharp(jpeg)
        .resize(Math.round((meta.width ?? 0) * ocrScale(meta.width ?? 1, meta.height ?? 1)))
        .grayscale()
        .normalise()
        .png()
        .toBuffer();
      const out = await sharp(png).metadata();
      const words = await readWords(png);

      // Segunda pasada solo sobre la cabecera (el 20 % de arriba), con otro modo de lectura:
      // el modo "texto suelto" se salta los recuadros con las fechas de validez ("Horarios válidos desde...").
      const bandHeight = Math.round((out.height ?? 0) * HEADER_BAND);
      if (bandHeight > 0) {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
        try {
          const band = await sharp(png)
            .extract({ left: 0, top: 0, width: out.width ?? 0, height: bandHeight })
            .png()
            .toBuffer();
          for (const w of await readWords(band)) {
            // Solo añadimos lo que la primera pasada no había leído ya en ese mismo sitio.
            if (!words.some((o) => overlaps(o, w))) words.push(w);
          }
        } finally {
          await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
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
