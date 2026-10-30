/**
 * Analiza las palabras que ha leído el OCR de un PDF de horarios (función pura, sin leer archivos ni red).
 * Saca tres cosas: las horas marcadas con una letra (por ejemplo "21:38a"), la leyenda de esas letras
 * ("a: Retirada en Moreno Mendoza") y las fechas de validez del horario.
 * Todo lo que no se puede leer con seguridad va a `unreadable` para que una persona lo revise.
 */
import type { TimeOfDay } from '../../../src/data/schema';
import type { OcrPage, OcrWord } from './ocr';

/** Una entrada de la leyenda: la letra (en minúscula) y su explicación. */
export interface LegendEntry {
  mark: string;
  text: string;
}

/** Una hora marcada: en qué parada, a qué hora ("HH:MM") y con qué letra. */
export interface MarkedTime {
  stopCode: string;
  time: TimeOfDay;
  mark: string;
}

/** Todo lo que se saca de un PDF. */
export interface ParsedPdf {
  /** Inicio de validez, "AAAA-MM-DD". */
  validFrom: string | null;
  /** Fin de validez, "AAAA-MM-DD". */
  validTo: string | null;
  /** Por ejemplo "Invierno 2026/2027". */
  periodName: string | null;
  legend: LegendEntry[];
  marks: MarkedTime[];
  /** Textos que no se han podido leer con seguridad (horas que no existen en el buscador, letras sin leyenda...). */
  unreadable: string[];
}

const cx = (w: OcrWord) => (w.x0 + w.x1) / 2;
const cy = (w: OcrWord) => (w.y0 + w.y1) / 2;
const height = (w: OcrWord) => w.y1 - w.y0;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
}

/**
 * Agrupa las palabras en líneas de texto (las que están a la misma altura) y las ordena de arriba abajo
 * y de izquierda a derecha. `tolerance` dice cuánto puede variar el centro vertical (en alturas de palabra),
 * y `minTolerance` es lo mínimo que se admite en píxeles (para palabras muy pequeñas).
 */
function groupLines(words: OcrWord[], tolerance = 0.6, minTolerance = 0): OcrWord[][] {
  const sorted = [...words].sort((a, b) => cy(a) - cy(b));
  const lines: { y: number; words: OcrWord[] }[] = [];
  for (const w of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(cy(w) - last.y) <= Math.max(tolerance * height(w), minTolerance, 1)) {
      last.words.push(w);
      last.y = last.words.reduce((sum, o) => sum + cy(o), 0) / last.words.length;
    } else {
      lines.push({ y: cy(w), words: [w] });
    }
  }
  return lines.map((l) => l.words.sort((a, b) => a.x0 - b.x0));
}

// ---------------------------------------------------------------------------------------------
// Columnas (la fila "CÓDIGO PARADA")
// ---------------------------------------------------------------------------------------------

/** Una columna de horas: dónde está (centro x), a qué parada pertenece (si se sabe) y las palabras que contiene. */
interface Column {
  cx: number;
  stopCode: string | null;
  words: OcrWord[];
}

/** Una fila de códigos de parada (cada tabla tiene la suya) y las columnas que cuelgan de ella. */
interface Row {
  y: number;
  codes: OcrWord[];
  columns: Column[];
}

/** Una palabra que empieza como una hora ("21:38", "21:38a", "7:55C"...). */
const looksLikeTime = (w: OcrWord) => /^\d{1,2}[:.]\d{2}/.test(w.text);

/** Pasa "7", "55" a "07:55". */
const toTime = (h: string, m: string) => `${h.padStart(2, '0')}:${m}` as TimeOfDay;

/** La hora "HH:MM" que hay al principio de una palabra, sin la letra de marca (o null si no hay). */
function plainTime(text: string): { h: string; min: string } | null {
  const m = /^(\d{1,2})[:.](\d{2})/.exec(text);
  return m ? { h: m[1], min: m[2] } : null;
}

/** Busca las filas de códigos: grupos de números de 1 a 3 cifras alineados, con al menos 3 y alguna parada conocida. */
function findRows(words: OcrWord[], known: Record<string, TimeOfDay[]>): Row[] {
  const numbers = words.filter((w) => /^\d{1,3}$/.test(w.text));
  const knownWords = numbers.filter((w) => known[w.text] !== undefined);
  const tolerance = 1.2 * median(knownWords.map(height));
  return groupLines(numbers, 1, tolerance)
    .filter((row) => row.length >= 3 && row.some((w) => known[w.text] !== undefined))
    .map((codes) => ({ y: median(codes.map(cy)), codes, columns: [] }));
}

/** La fila de códigos más cercana por encima de una palabra (null si está por encima de todas). */
function rowFor(word: OcrWord, rows: Row[]): Row | null {
  let best: Row | null = null;
  for (const r of rows) {
    if (r.y < word.y0 && (!best || r.y > best.y)) best = r;
  }
  return best;
}

/** Cuántas horas de una columna coinciden con las del buscador para una parada. */
function hitsFor(column: Column, times: TimeOfDay[]): number {
  let hits = 0;
  for (const w of column.words) {
    const t = plainTime(w.text);
    if (!t) continue;
    if (times.includes(toTime(t.h, t.min)) || (t.h.length === 1 && times.includes(toTime(`1${t.h}`, t.min)))) hits++;
  }
  return hits;
}

/**
 * Reparte las palabras con forma de hora en columnas (por su posición x) y a cada columna le pone la parada
 * cuyo código está justo encima. Si el código de una columna no se ha leído bien, se averigua la parada
 * comparando las horas de la columna con las del buscador (solo entre las paradas que aún no tienen columna).
 */
function buildColumns(words: OcrWord[], known: Record<string, TimeOfDay[]>): Row[] {
  const rows = findRows(words, known);
  if (rows.length === 0) return rows;
  const times = words.filter(looksLikeTime);
  const widths = median(times.map((w) => w.x1 - w.x0));

  // 1. Cada hora va a su fila; dentro de la fila se juntan en columnas las que tienen casi el mismo centro x.
  for (const row of rows) {
    const mine = times.filter((w) => rowFor(w, rows) === row).sort((a, b) => cx(a) - cx(b));
    for (const w of mine) {
      const last = row.columns[row.columns.length - 1];
      if (last && cx(w) - last.cx <= 0.5 * widths) {
        last.words.push(w);
        last.cx = last.words.reduce((sum, o) => sum + cx(o), 0) / last.words.length;
      } else {
        row.columns.push({ cx: cx(w), stopCode: null, words: [w] });
      }
    }

    // 2. El código conocido más cercano (en x) da la parada de la columna.
    const knownCodes = row.codes.filter((w) => known[w.text] !== undefined);
    for (const col of row.columns) {
      let best: OcrWord | null = null;
      for (const c of knownCodes) {
        if (!best || Math.abs(cx(c) - col.cx) < Math.abs(cx(best) - col.cx)) best = c;
      }
      if (best && Math.abs(cx(best) - col.cx) <= 0.75 * widths) col.stopCode = best.text;
    }

    // 3. Columnas sin parada: se prueban las paradas que no tienen columna en esta fila.
    const taken = new Set(row.columns.map((c) => c.stopCode));
    for (const col of row.columns) {
      if (col.stopCode) continue;
      const scores = Object.keys(known)
        .filter((code) => !taken.has(code))
        .map((code) => ({ code, hits: hitsFor(col, known[code]) }))
        .sort((a, b) => b.hits - a.hits);
      const [first, second] = scores;
      // Hace falta que casi todas las horas de la columna coincidan, y que gane a la siguiente con claridad.
      if (first && first.hits >= 5 && first.hits >= 0.7 * col.words.length && first.hits > (second?.hits ?? 0) + 2) {
        col.stopCode = first.code;
        taken.add(first.code);
      }
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Horas marcadas
// ---------------------------------------------------------------------------------------------

/**
 * Intenta leer una palabra como hora marcada. Devuelve null si no tiene pinta de hora marcada (por ejemplo
 * una hora sin letra), y `{ raw }` si lo parece pero la hora no existe en el buscador para esa parada.
 */
function readMarked(
  text: string,
  times: TimeOfDay[],
): { time: TimeOfDay; mark: string } | { raw: string } | null {
  // Quitamos el ruido del OCR (%, comillas...) y pasamos a minúscula.
  const clean = text.replace(/[^0-9:.a-zA-Z]/g, '').toLowerCase();
  const m = /^(\d{1,2})[:.](\d{2})([a-z])[a-z]?$/.exec(clean);
  if (!m) return null;
  const [, h, min, mark] = m;
  const direct = toTime(h, min);
  if (times.includes(direct)) return { time: direct, mark };
  // "7:55c" suele ser "17:55c": al OCR se le cae el primer "1".
  if (h.length === 1) {
    const withOne = toTime(`1${h}`, min);
    if (times.includes(withOne)) return { time: withOne, mark };
  }
  return { raw: text };
}

// ---------------------------------------------------------------------------------------------
// Leyenda
// ---------------------------------------------------------------------------------------------

const LETTER_ONLY = /^[a-z][:.]?$/;

/** Lee las líneas de la leyenda (debajo de "OBSERVACIONES") como textos sueltos, de arriba abajo. */
function legendLines(words: OcrWord[]): string[] {
  const title = words.find((w) => /^observaciones/i.test(w.text.replace(/[^a-zA-Z]/g, '')));
  if (!title) return [];
  const titleWidth = title.x1 - title.x0;
  // La leyenda está debajo del título; a la derecha, en el pie, hay otros textos (oficinas, teléfonos).
  const below = words.filter((w) => w !== title && w.y0 > title.y1 && w.x0 >= title.x0 - titleWidth);
  // Nos quedamos con la franja horizontal que toca al título: se va ampliando hacia la derecha
  // mientras el hueco con la siguiente palabra sea pequeño (la letra de la leyenda va en una celda aparte).
  const h = median(below.map(height));
  const maxGap = 6 * h;
  const sorted = [...below].sort((a, b) => a.x0 - b.x0);
  let right = title.x1;
  for (const w of sorted) {
    if (w.x0 - right <= maxGap) right = Math.max(right, w.x1);
    else if (w.x0 > right) break;
  }
  const legendWords = below.filter((w) => w.x0 <= right);
  return groupLines(legendWords, 0.5).map((line) => line.map((w) => w.text).join(' '));
}

/** Convierte las líneas de la leyenda en entradas "letra + texto". Las letras perdidas se rellenan con `usedMarks`. */
function buildLegend(lines: string[], usedMarks: string[], unreadable: string[]): LegendEntry[] {
  const withLetter: LegendEntry[] = [];
  const withoutLetter: string[] = [];
  for (const line of lines) {
    const text = line.replace(/^[^0-9a-zA-ZÀ-ÿ]+/, '').trim();
    const m = /^([a-z])(?:\s*[:.]\s*|\s+)(\S.*)$/.exec(text);
    if (m) withLetter.push({ mark: m[1], text: m[2].trim() });
    else if (text) withoutLetter.push(text);
  }
  const claimed = new Set(withLetter.map((e) => e.mark));
  const free = usedMarks.filter((l) => !claimed.has(l));
  const legend = [...withLetter];
  // Si faltan letras, se reparten por orden alfabético, pero solo si cuadra exactamente.
  if (withoutLetter.length > 0 && withoutLetter.length === free.length) {
    withoutLetter.forEach((text, i) => legend.push({ mark: free[i], text }));
  } else if (withLetter.length === 0 && withoutLetter.length > 0) {
    // Ninguna letra se ha leído y hay más entradas que letras usadas (alguna letra no sale en las horas):
    // la leyenda siempre va en orden a, b, c... así que se numeran por posición, si así quedan cubiertas todas las usadas.
    const letters = withoutLetter.map((_, i) => String.fromCharCode(97 + i));
    if (usedMarks.every((l) => letters.includes(l))) {
      withoutLetter.forEach((text, i) => legend.push({ mark: letters[i], text }));
    }
  }
  for (const letter of usedMarks) {
    if (!legend.some((e) => e.mark === letter)) unreadable.push(`legend:${letter}`);
  }
  return legend.sort((a, b) => a.mark.localeCompare(b.mark));
}

// ---------------------------------------------------------------------------------------------
// Validez
// ---------------------------------------------------------------------------------------------

/** "07/09/2026" a "2026-09-07" (null si no es una fecha posible). */
function isoDate(d: string, m: string, y: string): string | null {
  if (+m < 1 || +m > 12 || +d < 1 || +d > 31) return null;
  return `${y}-${m}-${d}`;
}

function readValidity(words: OcrWord[]): Pick<ParsedPdf, 'validFrom' | 'validTo' | 'periodName'> {
  // Unimos todo el texto por líneas (la cabecera tiene varios recuadros en la misma fila).
  const text = groupLines(words)
    .map((line) => line.map((w) => w.text).join(' '))
    .join('\n');
  const dates = /v[aá]lidos\s+desde\s+(\d{2})\/(\d{2})\/(\d{4})\s+al\s+(\d{2})\/(\d{2})\/(\d{4})/i.exec(text);
  const period = /(Invierno|Verano)\s+(\d{4}\/\d{4})/i.exec(text);
  const name = period ? period[1][0].toUpperCase() + period[1].slice(1).toLowerCase() : null;
  return {
    validFrom: dates ? isoDate(dates[1], dates[2], dates[3]) : null,
    validTo: dates ? isoDate(dates[4], dates[5], dates[6]) : null,
    periodName: period && name ? `${name} ${period[2]}` : null,
  };
}

// ---------------------------------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------------------------------

/**
 * Analiza una página leída por OCR.
 * `known` son las horas que da el buscador para esa línea y ese tipo de día, por código de parada:
 * sirven para saber en qué columna está cada hora y para comprobar que la hora se ha leído bien.
 */
export function parsePage(page: OcrPage, known: Record<string, TimeOfDay[]>): ParsedPdf {
  const marks: MarkedTime[] = [];
  const unreadable: string[] = [];

  for (const row of buildColumns(page.words, known)) {
    for (const column of row.columns) {
      // Una columna sin parada reconocida (otra línea, código ilegible...) no se puede comprobar: se ignora.
      if (!column.stopCode) continue;
      for (const word of column.words) {
        const read = readMarked(word.text, known[column.stopCode]);
        if (!read) continue;
        if ('raw' in read) unreadable.push(read.raw);
        else marks.push({ stopCode: column.stopCode, time: read.time, mark: read.mark });
      }
    }
  }

  const usedMarks = [...new Set(marks.map((m) => m.mark))].sort();
  const legend = buildLegend(legendLines(page.words), usedMarks, unreadable);
  return { ...readValidity(page.words), legend, marks, unreadable };
}
