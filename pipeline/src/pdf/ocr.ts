/**
 * Lector OCR de los PDF de horarios: convierte la imagen JPEG en una lista de palabras con su posición.
 * Para que la letra diminuta se lea bien, la imagen se amplía ×3 y se pasa a gris con más contraste.
 * Para que no tarde demasiado, se lee por franjas horizontales (ver `strips`).
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

/**
 * Alto de cada franja horizontal en la que se trocea la imagen para el OCR (en píxeles de la imagen ampliada).
 * El tiempo del OCR crece con el cuadrado de la altura: la línea 8 entera tardaba más de 15 minutos,
 * y por franjas tarda alrededor de un minuto.
 */
export const STRIP_HEIGHT = 500;

/** Lo que se solapan dos franjas seguidas: más que la palabra más alta, para que ninguna se quede partida. */
export const STRIP_OVERLAP = 160;

/** Una franja: desde `top` lee `height` píxeles, y se queda con las palabras cuyo centro cae entre `keepFrom` y `keepTo`. */
export interface Strip {
  top: number;
  height: number;
  keepFrom: number;
  keepTo: number;
}

/**
 * Trocea una altura en franjas que se solapan. Cada palabra se queda en una sola franja
 * (la que contiene su centro en su zona "propia"), así no salen repetidas ni partidas.
 */
export function strips(totalHeight: number): Strip[] {
  const out: Strip[] = [];
  const step = STRIP_HEIGHT - STRIP_OVERLAP;
  for (let top = 0; top < totalHeight; top += step) {
    const height = Math.min(STRIP_HEIGHT, totalHeight - top);
    const last = top + height >= totalHeight;
    out.push({
      top,
      height,
      keepFrom: top === 0 ? 0 : top + STRIP_OVERLAP / 2,
      keepTo: last ? totalHeight : top + height - STRIP_OVERLAP / 2,
    });
    if (last) break;
  }
  return out;
}

/** Umbral de blanco y negro de Otsu (el que usa tesseract por defecto) calculado sobre la imagen entera en gris. */
export async function otsuThreshold(gray: Buffer): Promise<number> {
  const { data } = await sharp(gray).grayscale().raw().toBuffer({ resolveWithObject: true });
  const hist = new Array<number>(256).fill(0);
  for (const v of data) hist[v]++;
  const total = data.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  // Se elige el umbral que más separa los dos grupos (tinta y fondo).
  let best = 128;
  let bestVar = -1;
  let wB = 0;
  let sumB = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0 || wB === total) continue;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / (total - wB);
    const between = wB * (total - wB) * (mB - mF) ** 2;
    if (between > bestVar) {
      bestVar = between;
      best = t + 1;
    }
  }
  return best;
}

/** Umbrales para leer las letras de la leyenda: más oscuros que los bordes grises de las celdas. */
const LETTER_THRESHOLDS = [80, 110];

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

  /** Lee una imagen grande por franjas (ver `strips`) y devuelve las palabras con coordenadas de la imagen entera. */
  async function readWordsByStrips(image: Buffer, width: number, height: number): Promise<OcrWord[]> {
    const words: OcrWord[] = [];
    for (const s of strips(height)) {
      const crop = await sharp(image).extract({ left: 0, top: s.top, width, height: s.height }).png().toBuffer();
      for (const w of await readWords(crop)) {
        const moved = { ...w, y0: w.y0 + s.top, y1: w.y1 + s.top };
        const center = (moved.y0 + moved.y1) / 2;
        if (center >= s.keepFrom && center < s.keepTo) words.push(moved);
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
      // Blanco y negro con un solo umbral para toda la página: si tesseract lo calculara en cada franja,
      // en las franjas con barras oscuras se perderían los códigos de parada en gris.
      const bw = await sharp(png).threshold(await otsuThreshold(png)).png().toBuffer();
      const words = await readWordsByStrips(bw, out.width ?? 0, out.height ?? 0);

      // Segunda pasada solo sobre la cabecera (el 20 % de arriba), con otro modo de lectura:
      // el modo "texto suelto" se salta los recuadros con las fechas de validez ("Horarios válidos desde...").
      const bandHeight = Math.round((out.height ?? 0) * HEADER_BAND);
      if (bandHeight > 0) {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
        try {
          const band = await sharp(bw)
            .extract({ left: 0, top: 0, width: out.width ?? 0, height: bandHeight })
            .png()
            .toBuffer();
          for (const w of await readWordsByStrips(band, out.width ?? 0, bandHeight)) {
            // Solo añadimos lo que la primera pasada no había leído ya en ese mismo sitio.
            // Los números y las horas de esta pasada se ignoran: la franja incluye la fila de códigos de parada,
            // y una caja distinta de la primera pasada podría duplicar o inventar un código.
            if (/^\d{1,3}$/.test(w.text) || /^\d{1,2}[:.]\d{2}/.test(w.text)) continue;
            if (!words.some((o) => overlaps(o, w))) words.push(w);
          }
        } finally {
          await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
        }
      }

      // Pasada de códigos: la fila de códigos de parada (números en gris sobre fondo claro, bajo una barra oscura)
      // a veces se pierde con el umbral de toda la página. Se vuelve a leer la franja que hay justo encima
      // de cada "NOMBRE DE PARADAS" con un umbral calculado por zonas, y solo se añaden números nuevos.
      for (const header of words.filter((w) => /^NOMBRE$/.test(w.text))) {
        const h = header.y1 - header.y0;
        // La franja incluye algo de lo que hay debajo: sin ese contexto, tesseract no ve los códigos.
        const top = Math.max(0, Math.round(header.y0 - 16 * h));
        const height = Math.min(out.height ?? 0, Math.round(header.y0 + 12 * h)) - top;
        if (height <= 0) continue;
        await worker.setParameters({ thresholding_method: '1' } as Parameters<typeof worker.setParameters>[0]);
        try {
          const band = await sharp(png).extract({ left: 0, top, width: out.width ?? 0, height }).png().toBuffer();
          for (const w of await readWords(band)) {
            const code = { ...w, y0: w.y0 + top, y1: w.y1 + top };
            // Solo lo que está por encima de "NOMBRE": debajo están los números de transbordo, que no son paradas.
            if (code.y1 > header.y0) continue;
            if (/^\d{1,3}$/.test(code.text) && !words.some((o) => overlaps(o, code))) words.push(code);
          }
        } finally {
          await worker.setParameters({ thresholding_method: '0' } as Parameters<typeof worker.setParameters>[0]);
        }
      }

      // Tercera pasada: las letras de la leyenda (a, b, c...) van solas en una celda a la izquierda del texto
      // y la primera pasada suele perderlas. Se leen fila a fila, cada una en su propia ventana:
      // con un umbral oscuro (los bordes de las celdas son grises y desaparecen; las letras son negras),
      // un margen blanco alrededor y en modo "un solo carácter", solo con letras.
      const title = words.find((w) => /^observaciones/i.test(w.text.replace(/[^a-zA-Z]/g, '')));
      if (title) {
        const tw = title.x1 - title.x0;
        const th = title.y1 - title.y0;
        // La primera palabra de cada fila de la leyenda empieza justo debajo del título, a su misma altura x.
        const starts = words
          .filter((w) => w.y0 > title.y1 && w.y0 < title.y1 + 12 * th && Math.abs(w.x0 - title.x0) <= 0.1 * tw)
          .sort((a, b) => a.y0 - b.y0)
          .filter((w, i, all) => i === 0 || w.y0 - all[i - 1].y0 > th / 2);
        const left = Math.max(0, Math.round(title.x0 - 0.7 * tw));
        const width = Math.round(0.65 * tw);
        const dark = await Promise.all(LETTER_THRESHOLDS.map((t) => sharp(png).threshold(t).png().toBuffer()));
        await worker.setParameters({ tessedit_char_whitelist: 'abcdefghijkl' });
        try {
          for (const start of starts) {
            const h = start.y1 - start.y0;
            const top = Math.max(0, Math.round(start.y0 - 0.6 * h));
            const bottom = Math.min(out.height ?? 0, Math.round(start.y1 + 0.6 * h));
            if (width <= 0 || bottom <= top) continue;
            // Se prueba con varios umbrales y modos hasta que sale una sola letra (a veces una combinación falla).
            let text = '';
            for (const [image, psm] of dark.flatMap((d) => [PSM.SINGLE_CHAR, PSM.SINGLE_LINE].map((m) => [d, m] as const))) {
              const crop = await sharp(image)
                .extract({ left, top, width, height: bottom - top })
                .extend({ top: 20, bottom: 20, left: 20, right: 20, background: '#ffffff' })
                .png()
                .toBuffer();
              await worker.setParameters({ tessedit_pageseg_mode: psm });
              text = (await worker.recognize(crop)).data.text.trim();
              if (/^[a-l]$/.test(text)) break;
            }
            if (!/^[a-l]$/.test(text)) continue;
            // La letra va en la fila de su texto, en el centro de la ventana (no hace falta más precisión).
            const letter: OcrWord = { text, x0: left + Math.round(width / 3), x1: left + Math.round((2 * width) / 3), y0: start.y0, y1: start.y1, confidence: 90 };
            // Lo que la primera pasada leyera en esa celda era la letra mal leída: se sustituye.
            for (let i = words.length - 1; i >= 0; i--) {
              const o = words[i];
              if (o.x0 >= left && o.x1 <= left + width && o.y1 > top && o.y0 < bottom) words.splice(i, 1);
            }
            words.push(letter);
          }
        } finally {
          await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: '' });
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
