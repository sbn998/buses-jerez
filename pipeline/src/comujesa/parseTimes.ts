/**
 * Lee las horas a las que pasa una línea por una parada.
 *
 * Comujesa devuelve tres cajas, cada una con un título en negrita y una lista de horas:
 * "Laborales" (sí, sin la "b"), "Sábados" y "Domingos y Festivos".
 * Aquí se busca cada título y se recogen todas las horas HH:MM de su caja.
 */
import * as cheerio from 'cheerio';
import type { DayType, StopTimes } from '../../../src/data/schema';

const LABELS: Record<string, DayType> = {
  laborales: 'lab',
  // Por si algún día Comujesa corrige la errata.
  laborables: 'lab',
  'sábados': 'sab',
  'domingos y festivos': 'fes',
};

export function parseTimes(html: string): StopTimes {
  const $ = cheerio.load(html);
  const result: StopTimes = { lab: [], sab: [], fes: [] };
  $('strong').each((_, el) => {
    const day = LABELS[$(el).text().trim().toLowerCase()];
    if (!day) return;
    // La caja es el elemento que contiene el título; sus horas están dentro.
    const boxText = $(el).parent().text();
    // Las horas van separadas por <br>, así que en el texto salen pegadas ("07:2807:45"):
    // por eso no se usa \b (límite de palabra) en la expresión.
    result[day] = boxText.match(/\d{2}:\d{2}/g) ?? [];
  });
  return result;
}
