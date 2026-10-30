// Pruebas de la elección del periodo de validez entre todos los PDF (la mayoría manda; los distintos se saltan).
import { describe, expect, it } from 'vitest';
import type { ParsedPdf } from '../src/pdf/parsePage';
import { pickPeriod } from '../src/pdf/readPdfs';

const pdf = (file: string, validFrom: string | null, validTo: string | null, periodName: string | null = 'Invierno 2026/2027') => ({
  file,
  parsed: { validFrom, validTo, periodName, legend: [], marks: [], unreadable: [], warnings: [] } as ParsedPdf,
});
const winter = (file: string) => pdf(file, '2026-09-07', '2027-06-27');

describe('pickPeriod', () => {
  it('takes the majority and skips the PDFs with other dates', () => {
    const r = pickPeriod([winter('A'), winter('B'), pdf('C', '2026-06-29', '2026-09-06', 'Verano 2026')], null);
    expect(r.period).toEqual({ name: 'Invierno 2026/2027', validFrom: '2026-09-07', validTo: '2027-06-27' });
    expect(r.skipped).toEqual(['C']);
    expect(r.warnings).toHaveLength(1);
  });

  it('ignores PDFs without dates', () => {
    const r = pickPeriod([winter('A'), pdf('B', null, null)], null);
    expect(r.period?.validTo).toBe('2027-06-27');
    expect(r.skipped).toEqual([]);
  });

  it('publishes no period on a tie', () => {
    const r = pickPeriod([winter('A'), pdf('B', '2026-06-29', '2026-09-06')], null);
    expect(r.period).toBeUndefined();
    expect(r.skipped).toEqual([]);
  });

  it('publishes no period when nothing is readable or the info page disagrees', () => {
    expect(pickPeriod([pdf('A', null, null)], null).period).toBeUndefined();
    expect(pickPeriod([winter('A')], '2026-09-14').period).toBeUndefined();
    expect(pickPeriod([winter('A')], '2026-09-07').period?.validFrom).toBe('2026-09-07');
  });
});
