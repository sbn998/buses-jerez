/**
 * Paso del proceso diario que lee los PDF de horarios de Comujesa y saca de ellos
 * las notas de viaje (letras como "Retirada en ...") y el periodo de validez.
 *
 * Para cada PDF: se mira si ha cambiado (HEAD), y solo si hace falta se descarga y se lee con OCR;
 * si no, se reutiliza el resultado guardado (ocr.json).
 * Un PDF que no se entiende del todo NO bloquea la publicación: se salta lo que no se pudo leer
 * (sus notas o su fecha) y se deja un aviso. Nunca se publica una nota dudosa; como mucho falta alguna.
 * Solo bloquea que haya muy pocos PDF (señal de que la web de Comujesa ha cambiado).
 */
import type { DayType, Line, SchedulePeriod, Stop } from '../../../src/data/schema';
import { createOcr } from './ocr';
import { extractJpeg } from './extractJpeg';
import { buildNotes } from './notes';
import { decide, downloadPdf, headPdf, sha256, type CachedPdf, type OcrCacheFile } from './ocrCache';
import { parsePage, type ParsedPdf } from './parsePage';
import { MIN_PDF_SOURCES, type PdfSource } from './sources';

const DAY_TYPES: DayType[] = ['lab', 'sab', 'fes'];

/** Segundos máximos para leer un PDF con OCR (unos 30 s lo normal, hasta ~3 min los más grandes). Se puede cambiar con OCR_TIMEOUT_S. */
const OCR_TIMEOUT_S = Number(process.env.OCR_TIMEOUT_S) > 0 ? Number(process.env.OCR_TIMEOUT_S) : 600;

export interface ReadPdfsInput {
  lines: Line[];
  stops: Record<string, Stop>;
  sources: PdfSource[];
  /** Fecha de inicio que anuncia la página «Información útil» (o null si no la da). */
  startDate: string | null;
  /** Resultados guardados de otros días (ocr.json publicado). */
  previous: OcrCacheFile;
  /** Correcciones a mano (pipeline/ocr-manual.json). */
  manual: OcrCacheFile;
  /** Se llama cada vez que hay un resultado nuevo (sirve para ir guardando la caché local mientras se lee). */
  onProgress?: (cache: OcrCacheFile) => void;
}

export interface ReadPdfsResult {
  /** Las líneas con `notes` y con los viajes recortados por las retiradas. */
  lines: Line[];
  period?: SchedulePeriod;
  /** Lo que hay que publicar como ocr.json. */
  cache: OcrCacheFile;
  /** Problemas que bloquean la publicación. */
  errors: string[];
  /** Avisos que no bloquean. */
  warnings: string[];
  /** Cuántas marcas se han leído por línea (para el resumen). */
  marksByLine: Record<string, number>;
}

export async function readPdfs(input: ReadPdfsInput): Promise<ReadPdfsResult> {
  const { stops, sources, previous, manual } = input;
  const errors: string[] = [];
  const warnings: string[] = [];
  const cache: OcrCacheFile = {};
  const marksByLine: Record<string, number> = {};

  if (sources.length < MIN_PDF_SOURCES) {
    errors.push(`only ${sources.length} PDF links found (expected at least ${MIN_PDF_SOURCES})`);
    return { lines: input.lines, cache, errors, warnings, marksByLine };
  }

  /** Resultado de cada PDF para agruparlo después por línea y tipo de día. */
  const results: { source: PdfSource; parsed: ParsedPdf }[] = [];
  let ocr: Awaited<ReturnType<typeof createOcr>> | null = null;

  try {
    for (const [i, source] of sources.entries()) {
      const line = input.lines.find((l) => l.id === source.lineId);
      if (!line) {
        warnings.push(`${source.file}: line ${source.lineId} does not exist, PDF ignored`);
        continue;
      }
      const started = Date.now();
      try {
        const cached = previous[source.file];
        const head = await headPdf(source.url);
        const decision = decide(source, head, cached, manual[source.file]);
        if (typeof decision === 'object') {
          errors.push(decision.error);
          continue;
        }

        let entry: CachedPdf | null = null;
        if (decision === 'reuse') {
          entry = cached;
          if (!head) warnings.push(`${source.file}: HEAD failed, cached result reused without checking`);
        } else {
          // 'manual' u 'ocr': hay que descargar el PDF (la huella sha256 dice si el archivo manual es de este PDF).
          let download: Awaited<ReturnType<typeof downloadPdf>> | null = null;
          try {
            download = await downloadPdf(source.url);
          } catch (err) {
            if (!cached) throw err;
            warnings.push(`${source.file}: download failed, cached result reused (${String(err)})`);
            entry = cached;
          }
          if (download) {
            const hash = sha256(download.bytes);
            const headers = { lastModified: download.head.lastModified ?? head?.lastModified ?? null, contentLength: download.head.contentLength ?? head?.contentLength ?? null };
            const manualEntry = manual[source.file];
            if (manualEntry && manualEntry.sha256 === hash) {
              entry = { ...manualEntry, file: source.file, ...headers, sha256: hash };
              console.log(`${source.file}: resultado manual aplicado`);
            } else if (cached && cached.sha256 === hash) {
              // El PDF no ha cambiado aunque las cabeceras sí: se reutiliza y se actualizan las cabeceras.
              if (manualEntry) warnings.push(`${source.file}: ocr-manual.json is for another version of the PDF and was ignored`);
              entry = { ...cached, ...headers };
            } else {
              if (manualEntry) warnings.push(`${source.file}: ocr-manual.json is for another version of the PDF and was ignored`);
              ocr ??= await createOcr();
              const reader = ocr;
              // Algunos PDF muy densos dejan al OCR dando vueltas sin acabar: pasado el tiempo se cancela y es un error de ese PDF.
              let timer: ReturnType<typeof setTimeout> | undefined;
              const reading = reader.read(extractJpeg(download.bytes));
              reading.catch(() => {});
              const timeout = new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error(`OCR timed out after ${OCR_TIMEOUT_S} s`)), OCR_TIMEOUT_S * 1000);
              });
              let page: Awaited<typeof reading>;
              try {
                page = await Promise.race([reading, timeout]);
              } catch (err) {
                if (String(err).includes('timed out')) {
                  ocr = null; // el lector atascado se descarta; el siguiente PDF crea uno nuevo
                  void reader.close().catch(() => {});
                }
                throw err;
              } finally {
                clearTimeout(timer);
              }
              const known = Object.fromEntries(Object.entries(line.timesByStop).map(([c, t]) => [c, t[source.dayType]]));
              entry = { file: source.file, ...headers, sha256: hash, result: parsePage(page, known, line.stopCodes) };
              console.log(`${source.file}: leído con OCR en ${Math.round((Date.now() - started) / 1000)} s (${i + 1}/${sources.length})`);
            }
          }
        }
        if (!entry) continue;

        cache[source.file] = entry;
        input.onProgress?.(cache);
        results.push({ source, parsed: entry.result });
        // Lo que no se pudo leer solo avisa: esas notas o esas fechas se quedan fuera.
        if (entry.result.unreadable.length > 0) {
          warnings.push(`${source.file}: unreadable ${entry.result.unreadable.join(', ')} (skipped)`);
        }
        for (const w of entry.result.warnings) warnings.push(`${source.file}: ${w}`);
      } catch (err) {
        errors.push(`${source.file}: ${String(err)}`);
      }
    }
  } finally {
    await ocr?.close();
  }

  // Periodo de validez (ver pickPeriod): los PDF con otras fechas se saltan enteros.
  const picked = pickPeriod(results.map((r) => ({ file: r.source.file, parsed: r.parsed })), input.startDate);
  warnings.push(...picked.warnings);
  const period = picked.period;
  const usable = results.filter((r) => !picked.skipped.includes(r.source.file));

  // Notas de viaje por línea y tipo de día (la línea 15 tiene dos PDF por tipo de día).
  const lines = input.lines.map((line) => {
    const mine = usable.filter((r) => r.source.lineId === line.id);
    if (mine.length === 0) return line;
    marksByLine[line.id] = mine.reduce((n, r) => n + r.parsed.marks.length, 0);
    const trips = { ...line.trips };
    const notes = {} as NonNullable<Line['notes']>;
    for (const day of DAY_TYPES) {
      const group = mine.filter((r) => r.source.dayType === day);
      const built = buildNotes(line, day, group.map((r) => r.parsed), stops);
      // Las notas que no cuadran (letra sin leyenda, "Retirada en" sin parada) ya se han saltado: solo avisamos.
      warnings.push(...built.errors.map((e) => `${e} (skipped)`));
      warnings.push(...built.warnings);
      trips[day] = built.trips;
      notes[day] = built.notes;
    }
    const hasNotes = DAY_TYPES.some((d) => notes[d].length > 0);
    return hasNotes ? { ...line, trips, notes } : { ...line, trips };
  });

  return { lines, period, cache, errors, warnings, marksByLine };
}

/**
 * Elige el periodo de validez: el que dicen la mayoría de los PDF. Los que dicen otro (por ejemplo, un PDF
 * del verano que se quedó sin cambiar en la web) van en `skipped`: sus horas marcadas serían de otro horario.
 * Si hay empate, no hay nombre de periodo o la página «Información útil» anuncia otra fecha de inicio,
 * no se publica periodo (solo un aviso).
 */
export function pickPeriod(
  pdfs: { file: string; parsed: ParsedPdf }[],
  startDate: string | null,
): { period?: SchedulePeriod; skipped: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const dated = pdfs.filter((r) => r.parsed.validFrom && r.parsed.validTo);
  const key = (r: (typeof pdfs)[number]) => `${r.parsed.validFrom}..${r.parsed.validTo}`;
  const votes = new Map<string, number>();
  for (const r of dated) votes.set(key(r), (votes.get(key(r)) ?? 0) + 1);
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return { skipped: [], warnings: ['no PDF has readable validity dates: no period published'] };
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) {
    const list = ranked.map(([k, n]) => `${k} x${n}`).join(' | ');
    return { skipped: [], warnings: [`the PDFs do not agree on the validity dates (tie): ${list}; no period published`] };
  }
  const winner = ranked[0][0];
  const others = dated.filter((r) => key(r) !== winner);
  for (const r of others) warnings.push(`${r.file}: validity ${key(r)} differs from the other PDFs (${winner}), PDF skipped`);
  const skipped = others.map((r) => r.file);
  const winners = dated.filter((r) => key(r) === winner);
  const { validFrom, validTo } = winners[0].parsed;
  const names = new Map<string, number>();
  for (const r of winners) if (r.parsed.periodName) names.set(r.parsed.periodName, (names.get(r.parsed.periodName) ?? 0) + 1);
  const name = [...names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!name) return { skipped, warnings: [...warnings, 'no PDF gives the name of the period: no period published'] };
  if (startDate !== null && startDate !== validFrom) {
    return { skipped, warnings: [...warnings, `the start date on the info page (${startDate}) differs from the PDFs (${validFrom}): no period published`] };
  }
  return { period: { name, validFrom: validFrom as string, validTo: validTo as string }, skipped, warnings };
}
