// Pruebas del analizador de OCR: horas marcadas, leyenda y fechas, con dos lecturas reales y páginas inventadas.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TimeOfDay } from '../../src/data/schema';
import type { OcrPage, OcrWord } from '../src/pdf/ocr';
import { parsePage } from '../src/pdf/parsePage';

/** Las horas del buscador (`bundled.json`) para una línea y el tipo de día "laborable". */
function knownFor(lineId: string): Record<string, TimeOfDay[]> {
  const bundled = JSON.parse(readFileSync(new URL('../../src/data/bundled.json', import.meta.url), 'utf8'));
  const line = bundled.lines.find((l: { id: string }) => l.id === lineId);
  const known: Record<string, TimeOfDay[]> = {};
  for (const [code, times] of Object.entries(line.timesByStop as Record<string, { lab: TimeOfDay[] }>)) {
    known[code] = times.lab;
  }
  return known;
}

function fixture(name: string): OcrPage {
  return JSON.parse(readFileSync(new URL(`./fixtures/ocr/${name}.json`, import.meta.url), 'utf8'));
}

const count = (marks: { mark: string }[], mark: string) => marks.filter((m) => m.mark === mark).length;

describe('parsePage con la línea 1 laborable (dos tablas)', () => {
  const parsed = parsePage(fixture('LINEA_1_LAB'), knownFor('1'));

  it('reads the validity dates and the period', () => {
    expect(parsed.validFrom).toBe('2026-09-07');
    expect(parsed.validTo).toBe('2027-06-27');
    expect(parsed.periodName).toBe('Invierno 2026/2027');
  });

  it('reads the legend', () => {
    expect(parsed.legend).toEqual([
      { mark: 'a', text: 'Retirada en Moreno Mendoza' },
      { mark: 'b', text: 'Retirada en Plaza Esteve' },
    ]);
  });

  it('finds the marked times in both tables', () => {
    expect(parsed.marks).toContainEqual({ stopCode: '343', time: '21:38', mark: 'a' });
    expect(parsed.marks).toContainEqual({ stopCode: '418', time: '21:56', mark: 'a' });
    expect(parsed.marks).toContainEqual({ stopCode: '449', time: '14:03', mark: 'b' });
    expect(parsed.marks).toContainEqual({ stopCode: '277', time: '14:18', mark: 'b' });
    expect(count(parsed.marks, 'a')).toBe(12);
    expect(count(parsed.marks, 'b')).toBe(6);
  });

  it('has nothing unreadable', () => {
    expect(parsed.unreadable).toEqual([]);
  });
});

describe('parsePage con la línea 15 NJ laborable (45 columnas)', () => {
  const known = knownFor('15');
  const parsed = parsePage(fixture('LINEA_15_NJ_LAB'), known);

  it('reads the three legend entries', () => {
    expect(parsed.legend).toEqual([
      { mark: 'a', text: 'Paso por Parque Tecnológico' },
      { mark: 'b', text: 'Retirada en Nva. Jarilla' },
      { mark: 'c', text: 'Retirada en Angustias' },
    ]);
  });

  it('finds at least 80 marked times and all of them exist in the buscador', () => {
    expect(parsed.marks.length).toBeGreaterThanOrEqual(80);
    for (const m of parsed.marks) expect(known[m.stopCode]).toContain(m.time);
  });
});

/** Una palabra inventada: texto y posición (cada letra mide 10 de ancho y 20 de alto). */
function word(text: string, x: number, y: number): OcrWord {
  return { text, x0: x, y0: y, x1: x + text.length * 10, y1: y + 20, confidence: 90 };
}

/** Una página inventada con 3 columnas (paradas 10, 20 y 30) y una hora marcada debajo de la parada 10. */
function synthetic(markedText: string): OcrPage {
  return {
    width: 1000,
    height: 1000,
    words: [word('10', 100, 100), word('20', 300, 100), word('30', 500, 100), word(markedText, 90, 200)],
  };
}

const syntheticKnown = { '10': ['17:55', '21:39'], '20': ['08:00'], '30': ['09:00'] };

describe('parsePage con páginas inventadas', () => {
  it('normalizes noisy marked times', () => {
    expect(parsePage(synthetic('7:55C'), syntheticKnown).marks).toEqual([{ stopCode: '10', time: '17:55', mark: 'c' }]);
    expect(parsePage(synthetic('21:39%a'), syntheticKnown).marks).toEqual([{ stopCode: '10', time: '21:39', mark: 'a' }]);
  });

  it('rejects marked time missing from buscador', () => {
    const parsed = parsePage(synthetic('9:99a'), syntheticKnown);
    expect(parsed.marks).toEqual([]);
    expect(parsed.unreadable).toContain('9:99a');
  });

  it('ignores times without a mark', () => {
    expect(parsePage(synthetic('21:39'), syntheticKnown).marks).toEqual([]);
  });

  it('gives the missing legend letters in alphabetical order when the count matches', () => {
    const page = synthetic('21:39a');
    page.words.push(word('OBSERVACIONES', 100, 700), word('Retirada en Plaza', 100, 740));
    const parsed = parsePage(page, syntheticKnown);
    expect(parsed.legend).toEqual([{ mark: 'a', text: 'Retirada en Plaza' }]);
  });

  it('reports a legend letter that cannot be recovered', () => {
    const parsed = parsePage(synthetic('21:39a'), syntheticKnown);
    expect(parsed.legend).toEqual([]);
    expect(parsed.unreadable).toContain('legend:a');
  });
});
