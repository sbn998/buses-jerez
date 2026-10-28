/**
 * Comprobación anual de los festivos locales de Jerez.
 *
 * Los 2 festivos locales no los publica ningún servicio en un formato que se pueda
 * leer automáticamente: salen en un PDF del BOJA, normalmente en octubre. Por eso
 * se escriben a mano en `holidays-local.json`, y este programa avisa cuando faltan:
 *
 * - Siempre hacen falta los del año actual.
 * - Desde el 1 de octubre, también los del año siguiente.
 *
 * Se ejecuta una vez al mes en GitHub (`.github/workflows/holidays.yml`). Si falta
 * algún año, el proceso abre una "Issue" (una tarea) en GitHub, que te llega por correo.
 */
import { readFileSync } from 'node:fs';
import type { LocalHolidays } from './holidays';

/** Mes (0 = enero) desde el que ya hay que tener los festivos del año siguiente. */
const NEXT_YEAR_FROM_MONTH = 9; // octubre

export function missingLocalYears(local: LocalHolidays, today: Date): number[] {
  const year = today.getUTCFullYear();
  const needed = today.getUTCMonth() >= NEXT_YEAR_FROM_MONTH ? [year, year + 1] : [year];
  // Cada año tiene 2 festivos locales: con menos, el año está incompleto.
  return needed.filter((y) => (local[String(y)] ?? []).length < 2);
}

// Cuando se ejecuta como programa (no desde las pruebas): imprime los años que faltan.
if (process.argv[1]?.endsWith('checkHolidays.ts')) {
  const local = JSON.parse(readFileSync(new URL('../holidays-local.json', import.meta.url), 'utf8')) as LocalHolidays;
  console.log(missingLocalYears(local, new Date()).join(' '));
}
