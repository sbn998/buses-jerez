/**
 * Festivos que usa el calendario de la app. En un festivo, los buses siguen el
 * horario de "Domingos y Festivos".
 *
 * - Nacionales y de Andalucía: se descargan cada día de date.nager.at, un servicio
 *   gratuito y sin clave.
 * - Locales de Jerez (2 al año): no los da ningún servicio, así que el autor los
 *   escribe a mano en `holidays-local.json` una vez al año (vienen en el BOJA). Si
 *   falta un año, se avisa pero no se bloquea la publicación.
 */
import type { Holiday } from '../../src/data/schema';

export interface NagerHoliday {
  date: string;
  localName: string;
  global: boolean;
  counties: string[] | null;
}

export type LocalHolidays = Record<string, { date: string; name: string }[]>;

const PRIORITY: Record<Holiday['scope'], number> = { local: 3, regional: 2, national: 1 };

export function buildHolidays(nager: NagerHoliday[], local: LocalHolidays, years: number[]) {
  const warnings: string[] = [];
  const all: Holiday[] = [];

  for (const h of nager) {
    if (h.global) all.push({ date: h.date, name: h.localName, scope: 'national' });
    else if (h.counties?.includes('ES-AN')) all.push({ date: h.date, name: h.localName, scope: 'regional' });
  }
  for (const year of years) {
    const entries = local[String(year)] ?? [];
    if (entries.length === 0) warnings.push(`no local holidays for ${year}`);
    for (const e of entries) all.push({ date: e.date, name: e.name, scope: 'local' });
  }

  // Si una fecha aparece dos veces, se queda la más específica (local > Andalucía > nacional).
  const byDate = new Map<string, Holiday>();
  for (const h of all) {
    const current = byDate.get(h.date);
    if (!current || PRIORITY[h.scope] > PRIORITY[current.scope]) byDate.set(h.date, h);
  }
  const holidays = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { holidays, warnings };
}
