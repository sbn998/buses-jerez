/**
 * Analiza las palabras que ha leído el OCR de un PDF de horarios (función pura, sin leer archivos ni red).
 * Saca tres cosas: las horas marcadas con una letra (por ejemplo "21:38a"), la leyenda de esas letras
 * ("a: Retirada en Moreno Mendoza") y las fechas de validez del horario.
 * Regla de oro: ante la duda no se marca nada. Una marca falsa es peor que una marca que falta,
 * así que lo dudoso se descarta y se anota en `warnings`; solo lo que impide fiarse de la
 * leyenda o de las fechas va a `unreadable` (eso sí bloquea).
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
  /** Problemas que BLOQUEAN: leyenda sin resolver, letra sin leyenda, fechas que faltan o no valen. */
  unreadable: string[];
  /** Marcas dudosas que se han descartado (parada y texto leído). No bloquean: solo informan. */
  warnings: string[];
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
// Horas
// ---------------------------------------------------------------------------------------------

/** Pasa "7", "55" a "07:55". */
const toTime = (h: string, m: string) => `${h.padStart(2, '0')}:${m}` as TimeOfDay;

/**
 * Las horas posibles de lo que se ha leído, que existen en el buscador.
 * Con 2 cifras solo hay una posibilidad. Con 1 cifra el OCR ha perdido otra: puede ser 0, 1 o 2 delante,
 * y solo se admite si exactamente una de las tres existe (si hay varias, no se sabe cuál es).
 */
function candidates(h: string, min: string, times: TimeOfDay[]): TimeOfDay[] {
  const options = h.length === 1 ? ['0', '1', '2'].map((p) => p + h).filter((x) => +x < 24) : [h];
  return options.map((x) => toTime(x, min)).filter((t) => times.includes(t));
}

/** Cómo es una palabra de una tabla: nada, hora normal, hora con letra, u hora con algo raro detrás. */
type WordKind =
  | { kind: 'other' }
  | { kind: 'plain' }
  | { kind: 'marked'; h: string; min: string; mark: string }
  | { kind: 'dubious' };

function classify(text: string): WordKind {
  const start = /^(\d{1,2})[:.](\d{2})(.*)$/s.exec(text);
  if (!start) return { kind: 'other' };
  // Quitamos el ruido del OCR (%, comillas...) y pasamos a minúscula.
  const clean = text.replace(/[^0-9:.a-zA-Z]/g, '').toLowerCase();
  const m = /^(\d{1,2})[:.](\d{2})([a-z])[a-z]?$/.exec(clean);
  if (m) return { kind: 'marked', h: m[1], min: m[2], mark: m[3] };
  // Una hora sin nada detrás (o con un punto) es una hora normal; con otro símbolo raro puede ser una letra ilegible.
  if (start[3].replace(/[\s.,:;]/g, '') === '') return { kind: 'plain' };
  return { kind: 'dubious' };
}

// ---------------------------------------------------------------------------------------------
// Columnas
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

/** Una columna necesita al menos estas horas para poder compararla con el buscador. */
const MIN_COLUMN_TIMES = 3;
/** Parte de las horas de la columna que tiene que existir en el buscador para aceptar una parada. */
const MIN_SHARE = 0.8;
/** Lo que tiene que ganar la parada elegida a las demás candidatas (en puntos de porcentaje / 100). */
const MIN_LEAD = 0.3;

const looksLikeTime = (w: OcrWord) => /^\d{1,2}[:.]\d{2}/.test(w.text);

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

/** Parte de las horas de una columna que coinciden (sin ambigüedad) con las del buscador para una parada. */
function share(column: Column, times: TimeOfDay[] | undefined): number {
  if (!times || column.words.length < MIN_COLUMN_TIMES) return 0;
  let hits = 0;
  for (const w of column.words) {
    const m = /^(\d{1,2})[:.](\d{2})/.exec(w.text);
    if (m && candidates(m[1], m[2], times).length === 1) hits++;
  }
  return hits / column.words.length;
}

/** Reparte las palabras con forma de hora en columnas por su posición x (las que tienen casi el mismo centro). */
function makeColumns(row: Row, times: OcrWord[], rows: Row[], widths: number): void {
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
}

/**
 * El código leído de cada columna: la palabra de código conocida más cercana en x. Cada palabra de código
 * sirve a una sola columna (la más cercana a ella); las demás se quedan sin código leído.
 */
function readCodes(row: Row, known: Record<string, TimeOfDay[]>, widths: number): (string | null)[] {
  const codes = row.codes.filter((w) => known[w.text] !== undefined);
  const nearest = row.columns.map((col) => {
    let best: OcrWord | null = null;
    for (const c of codes) {
      if (!best || Math.abs(cx(c) - col.cx) < Math.abs(cx(best) - col.cx)) best = c;
    }
    return best && Math.abs(cx(best) - col.cx) <= 0.75 * widths ? best : null;
  });
  return nearest.map((word, i) => {
    if (!word) return null;
    // Si otra columna está más cerca de esa misma palabra, la palabra es de la otra.
    const rival = row.columns.some(
      (other, j) => j !== i && nearest[j] === word && Math.abs(other.cx - cx(word)) < Math.abs(row.columns[i].cx - cx(word)),
    );
    return rival ? null : word.text;
  });
}

/**
 * Pone la parada a cada columna usando el ORDEN de paradas de la línea (`stopOrder`):
 *  1. Los códigos bien leídos se alinean con el orden (subsecuencia común más larga) y solo se aceptan
 *     como "anclas" si además ≥80 % de las horas de la columna existen en el buscador para esa parada.
 *  2. Las columnas entre dos anclas se reparten por posición si hay tantas columnas como paradas entre ellas;
 *     si no, se elige por horas entre las paradas de ese hueco.
 *  3. En todo caso una columna solo se acepta con ≥80 % de coincidencias y ganando por ≥30 puntos a las demás
 *     candidatas del hueco. Si no, se queda sin parada.
 */
function identifyColumns(row: Row, known: Record<string, TimeOfDay[]>, order: string[], widths: number): void {
  const n = row.columns.length;
  const L = order.length;
  const read = readCodes(row, known, widths);

  // Subsecuencia común más larga entre los códigos leídos y el orden de paradas (respeta el orden izquierda → derecha).
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(L + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = L - 1; j >= 0; j--) {
      dp[i][j] = read[i] !== null && read[i] === order[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const anchors: { col: number; pos: number }[] = [];
  for (let i = 0, j = 0; i < n && j < L; ) {
    if (read[i] !== null && read[i] === order[j] && dp[i][j] === dp[i + 1][j + 1] + 1) {
      // Solo es ancla si las horas lo confirman y ganan con claridad a las paradas contiguas (que pueden tener las mismas horas).
      const mine = share(row.columns[i], known[order[j]]);
      const beside = [order[j - 1], order[j + 1]].filter((o) => o !== undefined && o !== order[j]);
      if (mine >= MIN_SHARE && beside.every((o) => share(row.columns[i], known[o]) <= mine - MIN_LEAD)) {
        anchors.push({ col: i, pos: j });
      }
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  for (const a of anchors) row.columns[a.col].stopCode = order[a.pos];

  /** ¿La parada de esa posición gana con claridad a las demás del hueco? */
  const accept = (col: Column, pos: number, gap: number[]): boolean => {
    const mine = share(col, known[order[pos]]);
    if (mine < MIN_SHARE) return false;
    return gap.every((o) => order[o] === order[pos] || share(col, known[order[o]]) <= mine - MIN_LEAD);
  };

  const bounds = [{ col: -1, pos: -1 }, ...anchors, { col: n, pos: L }];
  for (let b = 0; b + 1 < bounds.length; b++) {
    const left = bounds[b];
    const right = bounds[b + 1];
    const cols: number[] = [];
    for (let i = left.col + 1; i < right.col; i++) cols.push(i);
    const gap: number[] = [];
    for (let p = left.pos + 1; p < right.pos; p++) gap.push(p);
    if (cols.length === 0 || gap.length === 0) continue;

    if (cols.length === gap.length) {
      cols.forEach((c, t) => {
        if (accept(row.columns[c], gap[t], gap)) row.columns[c].stopCode = order[gap[t]];
      });
    } else {
      // No cuadran las cuentas (hay columnas de paradas que el buscador no tiene): se elige por horas, siempre hacia la derecha.
      let last = left.pos;
      for (const c of cols) {
        const options = gap.filter((p) => p > last);
        const best = options.sort((a, b2) => share(row.columns[c], known[order[b2]]) - share(row.columns[c], known[order[a]]))[0];
        if (best !== undefined && accept(row.columns[c], best, options)) {
          row.columns[c].stopCode = order[best];
          last = best;
        }
      }
    }
  }
}

function buildColumns(words: OcrWord[], known: Record<string, TimeOfDay[]>, order: string[]): Row[] {
  const rows = findRows(words, known);
  if (rows.length === 0) return rows;
  const times = words.filter(looksLikeTime);
  const widths = median(times.map((w) => w.x1 - w.x0));
  for (const row of rows) {
    makeColumns(row, times, rows, widths);
    identifyColumns(row, known, order, widths);
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Leyenda
// ---------------------------------------------------------------------------------------------

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

/**
 * Convierte las líneas de la leyenda en entradas "letra + texto".
 * Solo nos fiamos si CADA línea tiene su letra leída y las letras son exactamente a, b, c... seguidas y en ese orden
 * (así es como están maquetadas). Si no, no se adivina nada: la leyenda queda vacía y cada letra usada
 * en las horas va a `unreadable` como `legend:<letra>`. Las letras usadas sin entrada también.
 */
function buildLegend(lines: string[], usedMarks: string[], unreadable: string[]): LegendEntry[] {
  const entries = lines
    .map((line) => line.replace(/^[^0-9a-zA-ZÀ-ÿ]+/, '').trim())
    .filter((text) => text !== '')
    .map((text) => {
      const m = /^([a-z])(?:\s*[:.]\s*|\s+)(\S.*)$/.exec(text);
      return m ? { letter: m[1], text: m[2].trim() } : { letter: null, text };
    });

  const trusted =
    entries.length > 0 && entries.every((e, i) => e.letter === String.fromCharCode(97 + i));
  const legend: LegendEntry[] = trusted ? entries.map((e) => ({ mark: e.letter as string, text: e.text })) : [];
  for (const letter of usedMarks) {
    if (!legend.some((e) => e.mark === letter)) unreadable.push(`legend:${letter}`);
  }
  return legend;
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
 * - `known`: las horas que da el buscador para esa línea y ese tipo de día, por código de parada.
 * - `stopOrder`: los códigos de parada de la línea en su orden de recorrido (`line.stopCodes`),
 *   que sirve para saber qué parada es cada columna aunque el OCR lea mal su código.
 */
export function parsePage(page: OcrPage, known: Record<string, TimeOfDay[]>, stopOrder: string[]): ParsedPdf {
  const marks: MarkedTime[] = [];
  const unreadable: string[] = [];
  const warnings: string[] = [];

  for (const row of buildColumns(page.words, known, stopOrder)) {
    /** Las horas marcadas aceptables de esta fila de la tabla, con la columna en que están. */
    const cells: { col: number; word: OcrWord; code: string; time: TimeOfDay; mark: string }[] = [];
    row.columns.forEach((column, col) => {
      const code = column.stopCode;
      for (const word of column.words) {
        const kind = classify(word.text);
        if (kind.kind === 'other' || kind.kind === 'plain') continue;
        if (!code) {
          warnings.push(`descartada ${word.text} en una columna sin parada identificada`);
        } else if (kind.kind === 'dubious') {
          warnings.push(`descartada ${word.text} en la parada ${code}: letra ilegible`);
        } else {
          const found = candidates(kind.h, kind.min, known[code]);
          if (found.length === 1) cells.push({ col, word, code, time: found[0], mark: kind.mark });
          else if (found.length === 0) warnings.push(`descartada ${word.text} en la parada ${code}: la hora no está en el buscador`);
          else warnings.push(`descartada ${word.text} en la parada ${code}: hora ambigua`);
        }
      }
    });

    // En un viaje todas las paradas seguidas llevan la misma letra: si en una tanda de celdas contiguas
    // (misma línea, columnas consecutivas) hay letras mezcladas, nos quedamos con la mayoritaria
    // (o con ninguna si hay empate), porque una letra mal leída daría una marca falsa.
    const byWord = new Map(cells.map((c) => [c.word, c]));
    for (const line of groupLines(cells.map((c) => c.word))) {
      const inLine = line.map((w) => byWord.get(w)!).sort((a, b) => a.col - b.col);
      let run: typeof inLine = [];
      const flush = () => {
        const counts = new Map<string, number>();
        for (const c of run) counts.set(c.mark, (counts.get(c.mark) ?? 0) + 1);
        const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        const winner = ranked.length === 1 || ranked[0][1] > ranked[1][1] ? ranked[0][0] : null;
        for (const c of run) {
          if (c.mark === winner) marks.push({ stopCode: c.code, time: c.time, mark: c.mark });
          else warnings.push(`descartada ${c.word.text} en la parada ${c.code}: letra distinta del resto de la fila`);
        }
        run = [];
      };
      for (const c of inLine) {
        if (run.length > 0 && c.col !== run[run.length - 1].col + 1) flush();
        run.push(c);
      }
      if (run.length > 0) flush();
    }
  }

  const validity = readValidity(page.words);
  if (!validity.validFrom || !validity.validTo) unreadable.push('validity:dates');
  if (!validity.periodName) unreadable.push('validity:period');

  const usedMarks = [...new Set(marks.map((m) => m.mark))].sort();
  const legend = buildLegend(legendLines(page.words), usedMarks, unreadable);
  return { ...validity, legend, marks, unreadable, warnings };
}
