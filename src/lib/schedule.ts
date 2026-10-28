// Lógica de horarios: decide qué tipo de día es una fecha (laborable, sábado o
// festivo) y calcula las próximas salidas de un autobús. No tiene pantallas:
// solo funciones puras que usará la pantalla de Horarios.
// Todas las fechas se interpretan en la hora LOCAL del móvil (no en UTC).
import type { DayType, Holiday, Line, TimeOfDay } from '@/data/schema';

/** Convierte una fecha a texto "AAAA-MM-DD" usando la hora local. */
export function toDateKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Devuelve el festivo de esa fecha, o undefined si no es festivo. */
export function holidayFor(d: Date, holidays: Holiday[]): Holiday | undefined {
  const key = toDateKey(d);
  return holidays.find((h) => h.date === key);
}

/** Sábado -> 'sab'; domingo o festivo -> 'fes'; resto -> 'lab'. */
export function dayTypeFor(d: Date, holidays: Holiday[]): DayType {
  if (holidayFor(d, holidays)) return 'fes';
  const weekday = d.getDay(); // 0 = domingo, 6 = sábado
  if (weekday === 6) return 'sab';
  if (weekday === 0) return 'fes';
  return 'lab';
}

/** Pasa "HH:MM" a minutos desde medianoche ("01:30" -> 90). */
export function minutesOfDay(t: TimeOfDay): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Las próximas `count` salidas desde `now` (comparando al minuto).
 * Una salida a la hora exacta cuenta, con minutesUntil = 0.
 * Si ya no quedan salidas hoy, devuelve una lista vacía.
 */
export function nextDepartures(
  times: TimeOfDay[],
  now: Date,
  count: number,
): { time: TimeOfDay; minutesUntil: number }[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return times
    .map((time) => ({ time, minutesUntil: minutesOfDay(time) - nowMinutes }))
    .filter((d) => d.minutesUntil >= 0)
    .sort((a, b) => a.minutesUntil - b.minutesUntil)
    .slice(0, count);
}

/** El destino ("headsign") del sentido de la línea que contiene la parada. */
export function headsignFor(line: Line, stopCode: string): string | null {
  const direction = line.directions.find((dir) => dir.stopCodes.includes(stopCode));
  return direction ? direction.headsign : null;
}

/** `count` días seguidos desde `start`, cada uno con su tipo de día y festivo. */
export function calendarDays(
  start: Date,
  count: number,
  holidays: Holiday[],
): { date: Date; key: string; dayType: DayType; holiday?: Holiday }[] {
  const days: { date: Date; key: string; dayType: DayType; holiday?: Holiday }[] = [];
  for (let i = 0; i < count; i++) {
    // new Date(año, mes, día + i) evita errores con los cambios de hora (DST).
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push({
      date,
      key: toDateKey(date),
      dayType: dayTypeFor(date, holidays),
      holiday: holidayFor(date, holidays),
    });
  }
  return days;
}
