/**
 * Descubre los PDF de horarios de Comujesa a partir de la página "Información útil".
 * Las direcciones de los PDF nunca se escriben a mano (la carpeta cambia en verano):
 * se leen de los enlaces de la página.
 */
import * as cheerio from 'cheerio';
import type { DayType } from '../../../src/data/schema';

/** Un PDF de horarios: de qué línea es y para qué tipo de día. */
export interface PdfSource {
  /** Nombre del archivo, por ejemplo "LINEA_15_NJ_LAB.pdf". */
  file: string;
  /** Dirección completa para descargarlo. */
  url: string;
  /** Línea a la que pertenece ("15" también para los _NJ_). */
  lineId: string;
  dayType: DayType;
}

/** Si salen menos PDF que esto, algo ha cambiado en la web y el proceso debe fallar (se esperan 57). */
export const MIN_PDF_SOURCES = 54;

const DAY_TYPES: Record<string, DayType> = { LAB: 'lab', SAB: 'sab', FES: 'fes' };

/** Busca todos los enlaces LINEA_<n>[_NJ]_{LAB,SAB,FES}.pdf (un solo PDF por nombre de archivo) y los devuelve con URL absoluta. */
export function parsePdfSources(html: string, baseUrl: string): PdfSource[] {
  const $ = cheerio.load(html);
  const found = new Map<string, PdfSource>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const path = href.split(/[?#]/)[0];
    let file: string;
    try {
      file = decodeURIComponent(path.slice(path.lastIndexOf('/') + 1));
    } catch {
      return; // enlace con un % mal escrito: lo saltamos
    }
    const match = /^LINEA_(\d+)(?:_NJ)?_(LAB|SAB|FES)\.pdf$/i.exec(file);
    if (!match) return;
    // Si el mismo archivo está enlazado dos veces (por ejemplo desde dos carpetas), gana el primero.
    if (found.has(file)) return;
    const url = new URL(href, baseUrl).toString();
    found.set(file, {
      file,
      url,
      lineId: match[1],
      dayType: DAY_TYPES[match[2].toUpperCase()],
    });
  });
  return [...found.values()];
}

const MONTHS: Record<string, string> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
  noviembre: '11', diciembre: '12',
};

/** Quita tildes y pasa a minúsculas, para comparar meses sin importar cómo estén escritos. */
const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Lee "A partir del Lunes 7 de Septiembre 2026" y lo devuelve como "2026-09-07" (o null si no aparece). */
export function parseStartDate(html: string): string | null {
  const text = plain(cheerio.load(html).text());
  const match = /a partir del\s+(?:[a-z]+\s+)?(\d{1,2})\s+de\s+([a-z]+)\s+(?:de\s+)?(\d{4})/.exec(text);
  if (!match) return null;
  const month = MONTHS[match[2]];
  if (!month) return null;
  return `${match[3]}-${month}-${match[1].padStart(2, '0')}`;
}
