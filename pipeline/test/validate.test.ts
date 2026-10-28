// Pruebas de la validación: cualquier dato roto o sospechoso tiene que bloquear la publicación.
import { describe, expect, it } from 'vitest';
import type { Dataset, Line } from '../../src/data/schema';
import { validate } from '../src/validate';

/** Dataset válido de prueba: 18 líneas, cada una con 2 paradas propias y 10 horas por parada. */
function makeDataset(): Dataset {
  const times = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
  const stops: Dataset['stops'] = {};
  const lines: Line[] = [];
  for (let i = 1; i <= 18; i++) {
    const codes = [`${i}01`, `${i}02`];
    for (const code of codes) {
      stops[code] = { code, name: 'P' + code, description: '', lat: 36.68, lon: -6.13, coordSource: 'kml' };
    }
    lines.push({
      id: String(i),
      name: 'L' + i,
      colour: '#000000',
      stopCodes: codes,
      directions: [{ headsign: 'X', stopCodes: codes }],
      shapes: [],
      timesByStop: Object.fromEntries(codes.map((c) => [c, { lab: [...times], sab: [], fes: [] }])),
      trips: { lab: [], sab: [], fes: [] },
    });
  }
  return { schemaVersion: 1, generatedAt: '2026-10-28T00:00:00Z', lines, stops, holidays: [] };
}

describe('validate', () => {
  it('accepts valid', () => {
    expect(validate(makeDataset(), makeDataset())).toEqual([]);
  });

  it('accepts when previous is null', () => {
    expect(validate(makeDataset(), null)).toEqual([]);
  });

  it('rejects missing line', () => {
    const ds = makeDataset();
    ds.lines = ds.lines.filter((l) => l.id !== '7');
    expect(validate(ds, null).join()).toMatch(/line 7/);
  });

  it('rejects line with no stops', () => {
    const ds = makeDataset();
    ds.lines[0].stopCodes = [];
    expect(validate(ds, null).length).toBeGreaterThan(0);
  });

  it('rejects stop without coordinates', () => {
    const ds = makeDataset();
    delete ds.stops['101'];
    expect(validate(ds, null).join()).toMatch(/101/);
  });

  it('rejects stop outside Jerez', () => {
    const ds = makeDataset();
    ds.stops['101'].lat = 40.4;
    expect(validate(ds, null).join()).toMatch(/101/);
  });

  it('rejects stop with no times', () => {
    const ds = makeDataset();
    ds.lines[0].timesByStop['101'] = { lab: [], sab: [], fes: [] };
    expect(validate(ds, null).join()).toMatch(/101/);
  });

  it('rejects bad time', () => {
    const ds = makeDataset();
    ds.lines[0].timesByStop['101'].lab[0] = '7:28';
    expect(validate(ds, null).join()).toMatch(/7:28/);
  });

  it('rejects unordered times', () => {
    const ds = makeDataset();
    ds.lines[0].timesByStop['101'].lab = ['09:00', '08:00'];
    expect(validate(ds, null).length).toBeGreaterThan(0);
  });

  it('rejects 25% drop in times', () => {
    const ds = makeDataset();
    for (const line of ds.lines) {
      for (const t of Object.values(line.timesByStop)) t.lab = t.lab.slice(0, 7);
    }
    expect(validate(ds, makeDataset()).join()).toMatch(/times/);
  });

  it('rejects 15% drop in stops', () => {
    const prev = makeDataset();
    for (let i = 1; i <= 8; i++) prev.stops[`x${i}`] = { ...prev.stops['101'], code: `x${i}` };
    // prev tiene 44 paradas y el nuevo 36: baja un 18 %.
    expect(validate(makeDataset(), prev).join()).toMatch(/stops/);
  });
});
