/**
 * Convierte las horas marcadas con letra de los PDF (las "marcas") en notas de viaje.
 *
 * Una marca dice "en la parada X, la hora H lleva la letra a". Para saber de qué VIAJE
 * es, se busca en los viajes reconstruidos (`line.trips`) la fila que tiene esa hora en
 * esa parada. Las marcas con la misma letra y el mismo viaje forman una nota.
 * Si la leyenda dice "Retirada en <parada>", el bus no sigue hasta el final: las horas
 * posteriores a la última parada marcada se ponen a `null` en ese viaje.
 */
import type { DayType, Line, Stop, TimeOfDay, TripNote } from '../../../src/data/schema';
import type { ParsedPdf } from './parsePage';

export interface BuildNotesResult {
  notes: TripNote[];
  /** Los viajes de la línea, con las horas de después de una retirada puestas a null. */
  trips: (TimeOfDay | null)[][];
  /** Problemas que bloquean (por ejemplo "Retirada en" una parada que no existe). */
  errors: string[];
  /** Marcas descartadas que no bloquean. */
  warnings: string[];
}

/** Sin tildes, en minúscula y con las abreviaturas escritas enteras, para comparar nombres de paradas. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bnva\b\.?/g, 'nueva')
    .replace(/\bavda?\b\.?/g, 'avenida')
    .replace(/\bpza?\b\.?/g, 'plaza')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const RETIRADA = /^retirada en (.+)$/i;

export function buildNotes(
  line: Line,
  day: DayType,
  parsed: ParsedPdf[],
  stops: Record<string, Stop>,
): BuildNotesResult {
  const trips = line.trips[day].map((row) => [...row]);
  const notes: TripNote[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const label = `line ${line.id} ${day}`;

  /** Nombre normalizado de cada parada de la línea (para buscar la "Retirada en X"). */
  const names = new Map<string, string>();
  for (const code of line.stopCodes) names.set(code, normalizeName(stops[code]?.name ?? ''));

  parsed.forEach((pdf, p) => {
    // Agrupa las marcas por letra y por viaje (la fila de `trips` que tiene esa hora en esa parada).
    const groups = new Map<string, { mark: string; row: number; times: Record<string, TimeOfDay>; lastIndex: number }>();
    for (const m of pdf.marks) {
      const index = line.stopCodes.indexOf(m.stopCode);
      const row = index < 0 ? -1 : trips.findIndex((t) => t[index] === m.time);
      if (row < 0) {
        // El OCR ya comprobó que la hora existe en el buscador; si no sale en ningún viaje es ruido de la reconstrucción.
        warnings.push(`${label}: marca ${m.mark} ${m.time} en la parada ${m.stopCode} descartada: no está en ningún viaje`);
        continue;
      }
      const key = `${m.mark}#${row}`;
      const group = groups.get(key) ?? { mark: m.mark, row, times: {}, lastIndex: -1 };
      group.times[m.stopCode] = m.time;
      group.lastIndex = Math.max(group.lastIndex, index);
      groups.set(key, group);
    }

    for (const group of [...groups.values()].sort((a, b) => a.row - b.row || a.mark.localeCompare(b.mark))) {
      const entry = pdf.legend.find((e) => e.mark === group.mark);
      if (!entry) {
        errors.push(`${label}: la letra ${group.mark} no tiene leyenda (PDF ${p + 1})`);
        continue;
      }
      const note: TripNote = { mark: group.mark, text: entry.text, times: group.times };
      const retirada = RETIRADA.exec(entry.text.trim());
      if (retirada) {
        const wanted = normalizeName(retirada[1]);
        const matches = line.stopCodes.filter((code, i) => names.get(code) === wanted && line.stopCodes.indexOf(code) === i);
        if (matches.length !== 1) {
          errors.push(`${label}: "${entry.text}" coincide con ${matches.length} paradas de la línea (debe ser 1)`);
          continue;
        }
        note.endsAt = matches[0];
        // El bus se retira: no hay horas después de la última parada marcada.
        for (let i = group.lastIndex + 1; i < trips[group.row].length; i++) trips[group.row][i] = null;
      }
      notes.push(note);
    }
  });

  return { notes, trips, errors, warnings };
}
