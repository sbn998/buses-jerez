// Regla única para validar una combinación línea + parada: la línea debe existir, la parada
// debe existir y además pertenecer al recorrido de esa línea. La usan la pantalla y los favoritos.
import type { Dataset, Line, Stop } from '@/data/schema';

export function findLineStop(
  data: Dataset,
  lineId: string | null,
  stopCode: string | null,
): { line: Line; stop: Stop } | null {
  if (!lineId || !stopCode) return null;
  const line = data.lines.find((l) => l.id === lineId);
  const stop = data.stops[stopCode];
  if (!line || !stop || !line.stopCodes.includes(stopCode)) return null;
  return { line, stop };
}
