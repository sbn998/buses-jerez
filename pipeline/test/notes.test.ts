// Pruebas de las notas de viaje: marcas del OCR de la línea 1 sobre los viajes de bundled.json.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Dataset, Line } from '../../src/data/schema';
import type { OcrPage } from '../src/pdf/ocr';
import { buildNotes, normalizeName } from '../src/pdf/notes';
import { parsePage, type ParsedPdf } from '../src/pdf/parsePage';

const bundled: Dataset = JSON.parse(readFileSync(new URL('../../src/data/bundled.json', import.meta.url), 'utf8'));
const line1 = bundled.lines.find((l) => l.id === '1') as Line;

const known = Object.fromEntries(Object.entries(line1.timesByStop).map(([c, t]) => [c, t.lab]));
const page: OcrPage = JSON.parse(readFileSync(new URL('./fixtures/ocr/LINEA_1_LAB.json', import.meta.url), 'utf8'));
const parsed = parsePage(page, known, line1.stopCodes);

/** Un PDF inventado con la leyenda y las marcas que se indiquen. */
const fake = (legend: ParsedPdf['legend'], marks: ParsedPdf['marks']): ParsedPdf => ({
  validFrom: '2026-09-07',
  validTo: '2027-06-27',
  periodName: 'Invierno 2026/2027',
  legend,
  marks,
  unreadable: [],
  warnings: [],
});

describe('buildNotes con la línea 1 laborable', () => {
  const result = buildNotes(line1, 'lab', [parsed], bundled.stops);

  it('makes two notes without errors', () => {
    expect(result.errors).toEqual([]);
    expect(result.notes).toHaveLength(2);
  });

  it('resolves "Retirada en Moreno Mendoza" and "Retirada en Plaza Esteve" to stop codes', () => {
    const a = result.notes.find((n) => n.mark === 'a')!;
    const b = result.notes.find((n) => n.mark === 'b')!;
    expect(a.endsAt).toBe('302');
    expect(a.text).toBe('Retirada en Moreno Mendoza');
    expect(b.endsAt).toBe('343');
  });

  it('nulls the times after the last marked stop of the trip', () => {
    const a = result.notes.find((n) => n.mark === 'a')!;
    expect(a.times['418']).toBeDefined();
    const index = line1.stopCodes.indexOf('418');
    const row = result.trips.find((t) => t[index] === a.times['418'])!;
    expect(row.slice(index + 1).every((t) => t === null)).toBe(true);
    expect(result.trips).toHaveLength(line1.trips.lab.length);
  });

  it('does not modify the original trips', () => {
    const before = JSON.stringify(line1.trips.lab);
    buildNotes(line1, 'lab', [parsed], bundled.stops);
    expect(JSON.stringify(line1.trips.lab)).toBe(before);
  });
});

describe('buildNotes con casos inventados', () => {
  // Cogemos un viaje real con horas en las tres primeras paradas.
  const row = line1.trips.lab.find((t) => t[0] !== null && t[1] !== null && t[2] !== null)!;
  const marks = [{ stopCode: line1.stopCodes[0], time: row[0]!, mark: 'a' }];

  it('only annotates the trip when it is not a retirada', () => {
    const r = buildNotes(line1, 'lab', [fake([{ mark: 'a', text: 'Paso por Parque Tecnológico' }], marks)], bundled.stops);
    expect(r.errors).toEqual([]);
    expect(r.notes).toEqual([{ mark: 'a', text: 'Paso por Parque Tecnológico', times: { [line1.stopCodes[0]]: row[0] } }]);
    expect(r.trips).toEqual(line1.trips.lab);
  });

  it('is an error when the retirada stop does not exist on the line', () => {
    const r = buildNotes(line1, 'lab', [fake([{ mark: 'a', text: 'Retirada en Xyz' }], marks)], bundled.stops);
    expect(r.errors).toHaveLength(1);
    expect(r.notes).toEqual([]);
  });

  it('is an error when a mark has no legend entry', () => {
    const r = buildNotes(line1, 'lab', [fake([], marks)], bundled.stops);
    expect(r.errors).toHaveLength(1);
  });

  it('drops (with a warning) a mark that is in no trip', () => {
    const r = buildNotes(
      line1,
      'lab',
      [fake([{ mark: 'a', text: 'x' }], [{ stopCode: '343', time: '03:33', mark: 'a' }])],
      bundled.stops,
    );
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.notes).toEqual([]);
  });
});

describe('normalizeName', () => {
  it('expands abbreviations and removes accents', () => {
    expect(normalizeName('Nva. Jarilla')).toBe('nueva jarilla');
    expect(normalizeName('Avda. Constitución')).toBe('avenida constitucion');
    expect(normalizeName('Pza. Esteve')).toBe('plaza esteve');
    expect(normalizeName('Pz. Esteve')).toBe('plaza esteve');
  });
});
