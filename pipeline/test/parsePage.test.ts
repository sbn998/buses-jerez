// Pruebas del analizador de OCR: horas marcadas, leyenda y fechas, con dos lecturas reales y páginas inventadas.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TimeOfDay } from '../../src/data/schema';
import type { OcrPage, OcrWord } from '../src/pdf/ocr';
import { parsePage } from '../src/pdf/parsePage';

/** Los datos del buscador (`bundled.json`) para una línea: horas laborables por parada y orden de paradas. */
function lineFor(lineId: string): { known: Record<string, TimeOfDay[]>; order: string[] } {
  const bundled = JSON.parse(readFileSync(new URL('../../src/data/bundled.json', import.meta.url), 'utf8'));
  const line = bundled.lines.find((l: { id: string }) => l.id === lineId);
  const known: Record<string, TimeOfDay[]> = {};
  for (const [code, times] of Object.entries(line.timesByStop as Record<string, { lab: TimeOfDay[] }>)) {
    known[code] = times.lab;
  }
  return { known, order: line.stopCodes };
}

function fixture(name: string): OcrPage {
  return JSON.parse(readFileSync(new URL(`./fixtures/ocr/${name}.json`, import.meta.url), 'utf8'));
}

const count = (marks: { mark: string }[], mark: string) => marks.filter((m) => m.mark === mark).length;

describe('parsePage con la línea 1 laborable (dos tablas)', () => {
  const { known, order } = lineFor('1');
  const parsed = parsePage(fixture('LINEA_1_LAB'), known, order);

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

  it('has nothing unreadable and no warnings', () => {
    expect(parsed.unreadable).toEqual([]);
    expect(parsed.warnings).toEqual([]);
  });
});

describe('parsePage con la línea 15 NJ laborable (45 columnas)', () => {
  const { known, order } = lineFor('15');
  const parsed = parsePage(fixture('LINEA_15_NJ_LAB'), known, order);

  it('reads the three legend entries', () => {
    expect(parsed.legend).toEqual([
      { mark: 'a', text: 'Paso por Parque Tecnológico' },
      { mark: 'b', text: 'Retirada en Nva. Jarilla' },
      { mark: 'c', text: 'Retirada en Angustias' },
    ]);
    expect(parsed.unreadable).toEqual([]);
  });

  it('finds exactly the expected marks per letter', () => {
    expect(parsed.marks).toHaveLength(104);
    expect(count(parsed.marks, 'a')).toBe(64);
    expect(count(parsed.marks, 'b')).toBe(0);
    expect(count(parsed.marks, 'c')).toBe(40);
    for (const m of parsed.marks) expect(known[m.stopCode]).toContain(m.time);
  });

  it('does not mark the neighbours that have the same times', () => {
    // Avd. Jerez I (308), Avd. Jerez II (87) y Nueva Jarilla (141) tienen horas casi iguales: ninguna se identifica con seguridad.
    expect(parsed.marks.filter((m) => ['87', '141', '308'].includes(m.stopCode))).toEqual([]);
  });

  it('reports the dropped marks as warnings, not as unreadable', () => {
    expect([...parsed.warnings].sort()).toEqual([
      'descartada 06:45c en una columna sin parada identificada',
      'descartada 07:02c en una columna sin parada identificada',
      'descartada 14:01a en una columna sin parada identificada',
      'descartada 15:31a en una columna sin parada identificada',
      'descartada 17:29€ en una columna sin parada identificada',
      'descartada 17:46c en una columna sin parada identificada',
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// Páginas inventadas
// ---------------------------------------------------------------------------------------------

/** Una palabra inventada: texto y posición (cada letra mide 10 de ancho y 20 de alto). */
function word(text: string, x: number, y: number): OcrWord {
  return { text, x0: x, y0: y, x1: x + text.length * 10, y1: y + 20, confidence: 90 };
}

/** Una columna inventada: el código que "leyó" el OCR (o null si lo leyó mal) y las horas que tiene debajo. */
interface Col {
  code: string | null;
  times: string[];
}

/** Una página con una fila de códigos y las columnas, separadas 200 píxeles. */
function table(cols: Col[], extra: OcrWord[] = []): OcrPage {
  const words: OcrWord[] = [...extra];
  cols.forEach((col, i) => {
    const x = 100 + i * 200;
    if (col.code) words.push(word(col.code, x, 100));
    col.times.forEach((t, j) => words.push(word(t, x, 200 + j * 40)));
  });
  return { width: 2000, height: 1000, words };
}

// Tres series de horas distintas, una por parada.
const A = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:30'];
const B = ['08:01', '09:01', '10:01', '11:01', '12:01', '13:01'];
const C = ['08:02', '09:02', '10:02', '11:02', '12:02', '13:02'];
const D = ['08:03', '09:03', '10:03', '11:03', '12:03', '13:03'];

describe('parsePage con páginas inventadas', () => {
  it('normalizes noisy marked times', () => {
    const known = { '10': [...A, '17:55', '21:39'], '20': B, '30': C };
    const page = table([
      { code: '10', times: [...A, '7:55C', '21:39%a'] },
      { code: '20', times: B },
      { code: '30', times: C },
    ]);
    expect(parsePage(page, known, ['10', '20', '30']).marks).toEqual([
      { stopCode: '10', time: '17:55', mark: 'c' },
      { stopCode: '10', time: '21:39', mark: 'a' },
    ]);
  });

  it('rejects marked time missing from buscador', () => {
    const page = table([
      { code: '10', times: [...A, '9:99a'] },
      { code: '20', times: B },
      { code: '30', times: C },
    ]);
    const parsed = parsePage(page, { '10': A, '20': B, '30': C }, ['10', '20', '30']);
    expect(parsed.marks).toEqual([]);
    expect(parsed.warnings).toEqual(['descartada 9:99a en la parada 10: la hora no está en el buscador']);
  });

  it('drops an ambiguous one-digit hour with a warning', () => {
    const known = { '10': [...A, '11:38', '21:38', '07:55', '17:55'], '20': B, '30': C };
    const page = table([
      { code: '10', times: [...A, '1:38a', '7:55c'] },
      { code: '20', times: B },
      { code: '30', times: C },
    ]);
    const parsed = parsePage(page, known, ['10', '20', '30']);
    expect(parsed.marks).toEqual([]);
    expect(parsed.warnings).toEqual([
      'descartada 1:38a en la parada 10: hora ambigua',
      'descartada 7:55c en la parada 10: hora ambigua',
    ]);
  });

  it('resolves a misread code by the stop order', () => {
    const known = { '10': A, '20': [...B, '21:39'], '30': C, '40': D };
    const page = table([
      { code: '10', times: A },
      { code: null, times: [...B, '21:39a'] },
      { code: '30', times: C },
      { code: '40', times: D },
    ]);
    expect(parsePage(page, known, ['10', '20', '30', '40']).marks).toEqual([{ stopCode: '20', time: '21:39', mark: 'a' }]);
  });

  it('leaves unidentified two columns whose stops have identical times', () => {
    const same = [...B, '21:39', '21:40'];
    const page = table([
      { code: '10', times: A },
      { code: null, times: [...B, '21:39a'] },
      { code: null, times: [...B, '21:40a'] },
      { code: '30', times: C },
      { code: '40', times: D },
    ]);
    const parsed = parsePage(page, { '10': A, '20': same, '21': same, '30': C, '40': D }, ['10', '20', '21', '30', '40']);
    expect(parsed.marks).toEqual([]);
    expect(parsed.warnings).toEqual([
      'descartada 21:39a en una columna sin parada identificada',
      'descartada 21:40a en una columna sin parada identificada',
    ]);
  });

  it('does not trust a code that the times do not confirm', () => {
    // La columna dice "20" pero sus horas son las de la parada 30: no se marca nada en ella.
    const page = table([
      { code: '10', times: A },
      { code: '20', times: [...C, '21:39a'] },
      { code: '30', times: C },
    ]);
    const parsed = parsePage(page, { '10': A, '20': B, '30': [...C, '21:39'] }, ['10', '20', '30']);
    expect(parsed.marks).toEqual([]);
    expect(parsed.warnings).toHaveLength(1);
  });

  it('ignores times without a mark', () => {
    const page = table([
      { code: '10', times: [...A, '21:39'] },
      { code: '20', times: B },
      { code: '30', times: C },
    ]);
    const parsed = parsePage(page, { '10': [...A, '21:39'], '20': B, '30': C }, ['10', '20', '30']);
    expect(parsed.marks).toEqual([]);
    expect(parsed.warnings).toEqual([]);
  });

  it('reports missing validity dates as unreadable', () => {
    const page = table([
      { code: '10', times: A },
      { code: '20', times: B },
      { code: '30', times: C },
    ]);
    expect(parsePage(page, { '10': A, '20': B, '30': C }, ['10', '20', '30']).unreadable).toEqual([
      'validity:dates',
      'validity:period',
    ]);
  });

  describe('leyenda', () => {
    const known = { '10': [...A, '21:39'], '20': [...B, '21:40'], '30': C };
    const cols = [
      { code: '10', times: [...A, '21:39a'] },
      { code: '20', times: [...B, '21:40c'] },
      { code: '30', times: C },
    ];
    const legend = (...lines: string[]) => [
      word('OBSERVACIONES', 100, 700),
      ...lines.map((text, i) => word(text, 100, 740 + i * 40)),
    ];
    const run = (...lines: string[]) => parsePage(table(cols, legend(...lines)), known, ['10', '20', '30']);

    it('trusts the legend when every line has its letter in a, b, c order', () => {
      const parsed = run('a: Uno', 'b: Dos', 'c: Tres');
      expect(parsed.legend).toEqual([
        { mark: 'a', text: 'Uno' },
        { mark: 'b', text: 'Dos' },
        { mark: 'c', text: 'Tres' },
      ]);
      expect(parsed.unreadable).not.toContain('legend:c');
    });

    it('does not guess letters that were not read', () => {
      const parsed = run('Uno', 'Dos');
      expect(parsed.legend).toEqual([]);
      expect(parsed.unreadable).toEqual(expect.arrayContaining(['legend:a', 'legend:c']));
    });

    it('does not trust a legend that lost its last line', () => {
      const parsed = run('a: Uno', 'b: Dos');
      expect(parsed.unreadable).toContain('legend:c');
      expect(parsed.legend.some((e) => e.mark === 'c')).toBe(false);
    });

    it('fills a lost middle letter by position when the last line has its letter', () => {
      const parsed = run('a: Uno', 'Dos', 'c: Tres');
      expect(parsed.legend.map((e) => e.mark)).toEqual(['a', 'b', 'c']);
      expect(parsed.legend[1].text).toBe('Dos');
      expect(parsed.unreadable.filter((u) => u.startsWith('legend:'))).toEqual([]);
    });

    it('does not fill letters when the last line has no letter', () => {
      const parsed = run('a: Uno', 'b: Dos', 'Tres');
      expect(parsed.legend).toEqual([]);
      expect(parsed.unreadable).toEqual(expect.arrayContaining(['legend:a', 'legend:c']));
    });

    it('does not trust a repeated letter', () => {
      const parsed = run('a: Uno', 'c: Dos', 'c: Tres');
      expect(parsed.legend).toEqual([]);
      expect(parsed.unreadable).toEqual(expect.arrayContaining(['legend:a', 'legend:c']));
    });

    it('does not trust letters out of order', () => {
      const parsed = run('c: Uno', 'a: Dos');
      expect(parsed.legend).toEqual([]);
      expect(parsed.unreadable).toEqual(expect.arrayContaining(['legend:a', 'legend:c']));
    });
  });

  describe('marcas mezcladas en una fila', () => {
    const known = { '10': [...A, '14:01'], '20': [...B, '14:02'], '30': [...C, '14:03'], '40': [...D, '14:04'] };
    const order = ['10', '20', '30', '40'];
    const run = (...cells: string[]) =>
      parsePage(
        table([
          { code: '10', times: [...A.slice(0, 6), cells[0]] },
          { code: '20', times: [...B, cells[1]] },
          { code: '30', times: [...C, cells[2]] },
          { code: '40', times: [...D, cells[3]] },
        ]),
        known,
        order,
      );

    it('drops the minority letter of a run', () => {
      const parsed = run('14:01a', '14:02c', '14:03a', '14:04');
      expect(parsed.marks.map((m) => `${m.time}${m.mark}`)).toEqual(['14:01a', '14:03a']);
      expect(parsed.warnings).toEqual(['descartada 14:02c en la parada 20: letra distinta del resto de la fila']);
    });

    it('drops the whole run on a tie', () => {
      const parsed = run('14:01a', '14:02c', '14:03', '14:04');
      expect(parsed.marks).toEqual([]);
      expect(parsed.warnings).toHaveLength(2);
    });

    it('keeps different letters in separate runs', () => {
      const parsed = run('14:01a', '14:02', '14:03c', '14:04c');
      expect(parsed.marks.map((m) => `${m.time}${m.mark}`)).toEqual(['14:01a', '14:03c', '14:04c']);
      expect(parsed.warnings).toEqual([]);
    });
  });

  it('does not accept an anchor that does not beat the neighbouring stop', () => {
    // Las paradas 20 y 30 tienen las mismas horas: aunque sus códigos se lean bien, no se sabe cuál es cuál.
    const same = [...B, '21:39'];
    const page = table([
      { code: '10', times: A },
      { code: '20', times: [...B, '21:39a'] },
      { code: '30', times: same },
      { code: '40', times: D },
    ]);
    const parsed = parsePage(page, { '10': A, '20': same, '30': same, '40': D }, ['10', '20', '30', '40']);
    expect(parsed.marks).toEqual([]);
    expect(parsed.warnings).toEqual(['descartada 21:39a en una columna sin parada identificada']);
  });
});
