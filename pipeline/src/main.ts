/**
 * Programa principal del proceso de datos. Es lo que ejecuta `npm run build-data`.
 *
 * Orden de los pasos:
 *  1. Para cada línea (1 a 18): lista de paradas → página de la línea → mapa
 *     oficial → horas de cada parada.
 *     Las horas se limpian (cleanTimes) al descargarlas.
 *  2. Descargar las paradas de OpenStreetMap (último recurso para ubicarlas),
 *     ensamblar líneas y paradas, y reconstruir los viajes de cada tipo de día.
 *  3. Añadir los festivos y los puntos de recarga.
 *  4. Leer los PDF oficiales (con OCR solo los que han cambiado): notas de viaje
 *     ("Retirada en ...") y periodo de validez. Ver src/pdf/readPdfs.ts.
 *  5. Descargar la versión publicada anterior y validar comparando con ella.
 *  6. Si todo está bien, escribir out/data.json, out/manifest.json y out/ocr.json.
 *     Si no, terminar con error (código 1) sin escribir nada publicable.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import type { Dataset, DayType, Line, Notice, StopTimes } from '../../src/data/schema';
import { SCHEMA_VERSION } from '../../src/data/schema';
import { assemble, type OsmStop, type Overrides, type RawLine } from './assemble';
import { INFO_URL, STOPS_URL, TIMES_URL, kmlUrl, linePageUrl } from './comujesa/endpoints';
import { parseKml } from './comujesa/parseKml';
import { parseLinePage } from './comujesa/parseLinePage';
import { parseStopOptions } from './comujesa/parseStops';
import { parseTimes } from './comujesa/parseTimes';
import { buildHolidays, type LocalHolidays, type NagerHoliday } from './holidays';
import { createClient } from './http';
import { makeManifest } from './manifest';
import { OVERPASS_QUERY, OVERPASS_URL, parseOverpass } from './osm';
import { osmCrossCheck } from './osmCrossCheck';
import { fetchPrevious } from './previous';
import { fetchPreviousOcr, type OcrCacheFile } from './pdf/ocrCache';
import { readPdfs } from './pdf/readPdfs';
import { parsePdfSources, parseStartDate } from './pdf/sources';
import { buildTrips } from './trips';
import { cleanTimes } from './cleanTimes';
import { loadTopUp, type TopUpFile } from './topup';
import { validate } from './validate';

const OUT_DIR = new URL('../out/', import.meta.url);
const LINE_IDS = Array.from({ length: 18 }, (_, i) => String(i + 1));
const DAY_TYPES: DayType[] = ['lab', 'sab', 'fes'];

const readJson = <T>(file: string): T => JSON.parse(readFileSync(new URL('../' + file, import.meta.url), 'utf8'));

async function downloadLine(
  client: ReturnType<typeof createClient>,
  id: string,
  warnings: string[],
): Promise<RawLine> {
  const options = parseStopOptions(await client.postForm(STOPS_URL, { valorLinea: id }));
  const page = parseLinePage(await client.getText(linePageUrl(id)));
  const kml = page.mapId ? parseKml(await client.getText(kmlUrl(page.mapId))) : null;
  const timesByStop: Record<string, StopTimes> = {};
  for (const opt of options) {
    const raw = parseTimes(await client.postForm(TIMES_URL, { valorCaja1: opt.code, valorLinea: id }));
    // Corrige los pequeños fallos de los datos oficiales y apunta cada corrección.
    const times = {} as StopTimes;
    for (const day of DAY_TYPES) {
      const cleaned = cleanTimes(raw[day]);
      times[day] = cleaned.times;
      for (const issue of cleaned.issues) warnings.push(`line ${id} stop ${opt.code} ${day}: ${issue}`);
    }
    timesByStop[opt.code] = times;
  }
  console.log(`línea ${id}: ${options.length} paradas, mapa ${kml ? 'sí' : 'NO'}`);
  return { id, options, page, kml, timesByStop };
}

async function main() {
  const client = createClient();
  const warnings: string[] = [];

  const raw: RawLine[] = [];
  for (const id of LINE_IDS) raw.push(await downloadLine(client, id, warnings));

  // Paradas de OpenStreetMap, como último recurso. Si Overpass falla, se sigue sin ellas.
  let osmStops: OsmStop[] = [];
  try {
    osmStops = parseOverpass(await client.postForm(OVERPASS_URL, { data: OVERPASS_QUERY }));
  } catch (err) {
    warnings.push(`OpenStreetMap not available (${String(err)})`);
  }

  const assembled = assemble(raw, readJson<Overrides>('overrides.json'), osmStops);
  warnings.push(...assembled.warnings);
  // Cruce con OpenStreetMap: solo avisos, nunca bloquea la publicación.
  warnings.push(...osmCrossCheck(assembled.stops, osmStops));
  let lines: Line[] = assembled.lines.map((line) => ({
    ...line,
    trips: Object.fromEntries(
      DAY_TYPES.map((day) => [
        day,
        buildTrips(line.stopCodes, Object.fromEntries(Object.entries(line.timesByStop).map(([c, t]) => [c, t[day]]))),
      ]),
    ) as Line['trips'],
  }));

  const year = new Date().getFullYear();
  const years = [year, year + 1];
  const nager: NagerHoliday[] = [];
  for (const y of years) {
    nager.push(...JSON.parse(await client.getText(`https://date.nager.at/api/v3/PublicHolidays/${y}/ES`)));
  }
  const holidays = buildHolidays(
    nager,
    readJson<LocalHolidays>('holidays-local.json'),
    years,
    readJson<LocalHolidays>('holidays-regional-extra.json'),
  );
  warnings.push(...holidays.warnings);

  // Puntos de recarga: copiados a mano del cartel oficial (topup-points.json).
  const topUp = readJson<TopUpFile>('topup-points.json');

  // PDF de horarios: notas de viaje y periodo de validez (lo lento es el OCR, y solo se hace si un PDF ha cambiado).
  const pdfs = await readPdfStep(client, lines, assembled.stops);
  lines = pdfs.lines;
  warnings.push(...pdfs.warnings);

  const dataset: Dataset = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    lines,
    stops: assembled.stops,
    holidays: holidays.holidays,
    topUpPoints: loadTopUp(topUp),
    topUpChecked: topUp.checked,
    ...(pdfs.period ? { period: pdfs.period } : {}),
    // Avisos escritos a mano; si el archivo no es una lista, validate() lo rechaza.
    notices: readJson<Notice[]>('notices.json'),
  };
  const prev = await fetchPrevious();
  if (prev.ok && prev.previous === null) warnings.push('no previous dataset (first run)');
  const errors = [...pdfs.errors, ...(prev.ok ? validate(dataset, prev.previous) : [prev.error])];
  report(dataset, warnings, errors);
  console.log('Marcas leídas de los PDF por línea:', JSON.stringify(pdfs.marksByLine));
  // Copia local opcional de la caché del OCR, para no repetir 20 minutos de OCR al probar en el ordenador.
  if (process.env.OCR_CACHE_FILE) writeFileSync(process.env.OCR_CACHE_FILE, JSON.stringify(pdfs.cache));

  rmSync(OUT_DIR, { recursive: true, force: true });
  if (errors.length > 0) process.exit(1);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(new URL('data.json', OUT_DIR), JSON.stringify(dataset));
  writeFileSync(new URL('manifest.json', OUT_DIR), JSON.stringify(makeManifest(dataset), null, 2));
  writeFileSync(new URL('ocr.json', OUT_DIR), JSON.stringify(pdfs.cache));
  writeFileSync(new URL('.nojekyll', OUT_DIR), '');
  console.log('Datos escritos en pipeline/out/');
}

/** Descubre los PDF de horarios y los lee (o reutiliza la caché del OCR). Ver src/pdf/readPdfs.ts. */
async function readPdfStep(client: ReturnType<typeof createClient>, lines: Line[], stops: Dataset['stops']) {
  const infoHtml = await client.getText(INFO_URL);
  // La caché publicada ayuda a ahorrar tiempo; si no se puede descargar, se lee todo otra vez.
  const local = process.env.OCR_CACHE_FILE;
  let previous: OcrCacheFile = {};
  let note: string | null = null;
  if (local && existsSync(local)) previous = JSON.parse(readFileSync(local, 'utf8'));
  else if (!local) {
    const fetched = await fetchPreviousOcr();
    if (fetched.ok) previous = fetched.cache;
    else note = `${fetched.error}: all PDFs will be read again`;
  }
  const result = await readPdfs({
    lines,
    stops,
    sources: parsePdfSources(infoHtml, INFO_URL),
    startDate: parseStartDate(infoHtml),
    previous,
    manual: readJson<OcrCacheFile>('ocr-manual.json'),
    onProgress: (cache) => {
      if (local) writeFileSync(local, JSON.stringify(cache));
    },
  });
  if (note) result.warnings.push(note);
  return result;
}

/** Muestra el resumen en la consola y, en GitHub Actions, también en la página del proceso. */
function report(ds: Dataset, warnings: string[], errors: string[]) {
  const times = ds.lines.reduce(
    (n, l) => n + Object.values(l.timesByStop).reduce((m, t) => m + t.lab.length + t.sab.length + t.fes.length, 0),
    0,
  );
  const text = [
    `## Datos de Buses Jerez`,
    `- Líneas: ${ds.lines.length}`,
    `- Paradas: ${Object.keys(ds.stops).length}`,
    `- Horas de paso: ${times}`,
    `- Festivos: ${ds.holidays.length}`,
    `### Errores (${errors.length})`,
    ...errors.map((e) => `- ${e}`),
    `### Avisos (${warnings.length})`,
    ...warnings.map((w) => `- ${w}`),
  ].join('\n');
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
