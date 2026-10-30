// Pruebas del descubrimiento de PDF y de la extracción de su imagen JPEG.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INFO_URL } from '../src/comujesa/endpoints';
import { extractJpeg } from '../src/pdf/extractJpeg';
import { MIN_PDF_SOURCES, parsePdfSources, parseStartDate } from '../src/pdf/sources';

const html = readFileSync(new URL('./fixtures/inf-util.html', import.meta.url), 'utf8');

describe('parsePdfSources', () => {
  it('finds the 57 PDFs with absolute URLs', () => {
    const sources = parsePdfSources(html, INFO_URL);
    expect(sources).toHaveLength(57);
    const nj = sources.find((s) => s.file === 'LINEA_15_NJ_LAB.pdf');
    expect(nj).toMatchObject({ lineId: '15', dayType: 'lab' });
    expect(nj?.url.startsWith('https://www.comujesa.es/fileadmin/')).toBe(true);
  });

  it('maps SAB and FES suffixes', () => {
    const sources = parsePdfSources(html, INFO_URL);
    expect(sources.find((s) => s.file === 'LINEA_1_SAB.pdf')?.dayType).toBe('sab');
    expect(sources.find((s) => s.file === 'LINEA_1_FES.pdf')?.dayType).toBe('fes');
  });

  it('fails when too few PDFs are found', () => {
    const few = Array.from({ length: 10 }, (_, i) => `<a href="/x/LINEA_${i + 1}_LAB.pdf">l</a>`).join('');
    expect(parsePdfSources(`<html>${few}</html>`, INFO_URL).length).toBeLessThan(MIN_PDF_SOURCES);
  });

  it('ignores duplicated links', () => {
    const dup = '<a href="/x/LINEA_1_LAB.pdf">a</a><a href="/x/LINEA_1_LAB.pdf">b</a>';
    expect(parsePdfSources(dup, INFO_URL)).toHaveLength(1);
  });

  it('keeps only the first link when the same file is linked from two folders', () => {
    const dup = '<a href="/a/LINEA_1_LAB.pdf">a</a><a href="/b/LINEA_1_LAB.pdf">b</a>';
    const sources = parsePdfSources(dup, INFO_URL);
    expect(sources).toHaveLength(1);
    expect(sources[0].url).toContain('/a/');
  });

  it('skips links with a broken percent escape instead of crashing', () => {
    const bad = '<a href="/x/LINEA_1_%E0%A4%A_LAB.pdf">a</a><a href="/x/LINEA_2_LAB.pdf">b</a>';
    expect(parsePdfSources(bad, INFO_URL).map((s) => s.file)).toEqual(['LINEA_2_LAB.pdf']);
  });
});

describe('parseStartDate', () => {
  it('reads the start date of the winter timetable', () => {
    expect(parseStartDate(html)).toBe('2026-09-07');
  });

  it('accepts months with or without accent and any casing', () => {
    expect(parseStartDate('<p>(A partir del Lunes 7 de SEPTIEMBRE 2026)</p>')).toBe('2026-09-07');
    expect(parseStartDate('<p>A partir del martes 1 de Setiembre 2027</p>')).toBe('2027-09-01');
    expect(parseStartDate('<p>A partir del Jueves 15 de MaRzO 2027</p>')).toBe('2027-03-15');
  });

  it('returns null when the phrase is missing', () => {
    expect(parseStartDate('<p>Sin fecha</p>')).toBeNull();
  });
});

describe('extractJpeg', () => {
  const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03, 0xff, 0xd9];

  it('returns exactly the bytes of the JPEG stream', () => {
    const pdf = Buffer.concat([
      Buffer.from('%PDF-1.4\n1 0 obj\n<< /Filter /DCTDecode >>\nstream\n', 'latin1'),
      Buffer.from(jpeg),
      Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1'),
    ]);
    expect([...extractJpeg(pdf)]).toEqual(jpeg);
  });

  it('returns the largest JPEG when the PDF has a thumbnail too', () => {
    const small = [0xff, 0xd8, 0xaa, 0xff, 0xd9];
    const pdf = Buffer.concat([
      Buffer.from('%PDF-1.4\nstream\n', 'latin1'),
      Buffer.from(small),
      Buffer.from('\nendstream\nstream\n', 'latin1'),
      Buffer.from(jpeg),
      Buffer.from('\nendstream\n%%EOF', 'latin1'),
    ]);
    expect([...extractJpeg(pdf)]).toEqual(jpeg);
  });

  it('throws when the PDF has no JPEG', () => {
    const pdf = Buffer.from('%PDF-1.4\nstream\nhello\nendstream\n%%EOF', 'latin1');
    expect(() => extractJpeg(pdf)).toThrow('PDF sin imagen JPEG');
  });
});
