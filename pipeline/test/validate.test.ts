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
    codes.forEach((code, j) => {
      // Cada parada en un sitio distinto (dos códigos en el mismo punto es un error).
      stops[code] = { code, name: 'P' + code, description: '', lat: 36.6 + i * 0.01, lon: -6.2 + j * 0.01, coordSource: 'kml' };
    });
    lines.push({
      id: String(i),
      name: 'L' + i,
      colour: '#000000',
      stopCodes: codes,
      directions: [{ headsign: 'X', stopCodes: codes }],
      shapes: [[[-6.13, 36.68], [-6.14, 36.69]]],
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

  it('rejects NaN or missing coordinates', () => {
    const ds = makeDataset();
    ds.stops['101'].lat = Number.NaN;
    delete (ds.stops['102'] as Partial<Dataset['stops'][string]>).lon;
    const errors = validate(ds, null).join();
    expect(errors).toMatch(/101/);
    expect(errors).toMatch(/102/);
  });

  it('rejects a line without map route', () => {
    const ds = makeDataset();
    ds.lines[2].shapes = [];
    expect(validate(ds, null).join()).toMatch(/line 3/);
  });

  it('rejects a line and day type that had times and now has none', () => {
    const prev = makeDataset();
    prev.lines[0].timesByStop['101'].sab = ['10:00'];
    expect(validate(makeDataset(), prev).join()).toMatch(/line 1.*sab/);
  });

  it('rejects a 35% rise in times', () => {
    const ds = makeDataset();
    for (const line of ds.lines) {
      for (const t of Object.values(line.timesByStop)) t.sab = t.lab.slice(0, 4);
    }
    expect(validate(ds, makeDataset()).join()).toMatch(/times/);
  });

  it('rejects duplicate times', () => {
    const ds = makeDataset();
    ds.lines[0].timesByStop['101'].lab = ['07:00', '07:00', '08:00'];
    expect(validate(ds, null).join()).toMatch(/duplicate/);
  });

  it('rejects two stop codes at the same point when one comes from OpenStreetMap', () => {
    const ds = makeDataset();
    ds.stops['102'] = { ...ds.stops['102'], lat: ds.stops['101'].lat, lon: ds.stops['101'].lon, coordSource: 'osm' };
    expect(validate(ds, null).join()).toMatch(/101.*102|102.*101/);
  });

  it('accepts two stop codes at the same point when the official map or the author says so', () => {
    const ds = makeDataset();
    ds.stops['102'] = { ...ds.stops['102'], lat: ds.stops['101'].lat, lon: ds.stops['101'].lon };
    expect(validate(ds, null)).toEqual([]);
    ds.stops['102'].coordSource = 'override';
    expect(validate(ds, null)).toEqual([]);
  });

  it('rejects 15% drop in stops', () => {
    const prev = makeDataset();
    for (let i = 1; i <= 8; i++) prev.stops[`x${i}`] = { ...prev.stops['101'], code: `x${i}` };
    // prev tiene 44 paradas y el nuevo 36: baja un 18 %.
    expect(validate(makeDataset(), prev).join()).toMatch(/stops/);
  });

  it('rejects a top-up point outside Jerez, or with only one coordinate', () => {
    const ds = makeDataset();
    ds.topUpChecked = "2026-10-29";
    ds.topUpPoints = [{ name: "A", address: "B", zone: "centro", lat: 40, lon: -3 }];
    expect(validate(ds, null).join()).toMatch(/top-up point #0.*outside Jerez/);
    ds.topUpPoints = [{ name: "A", address: "B", zone: "centro", lat: 36.68 }];
    expect(validate(ds, null).join()).toMatch(/top-up point #0.*coordinates/);
    ds.topUpPoints = [{ name: "A", address: "B", zone: "centro", lat: 36.68, lon: -6.13, approximate: true }];
    expect(validate(ds, null)).toEqual([]);
    ds.topUpPoints = [{ name: "A", address: "B", zone: "centro" }];
    expect(validate(ds, null)).toEqual([]);
  });

  it('rejects a period whose start is after its end', () => {
    const ds = makeDataset();
    ds.period = { name: 'Invierno 2026/2027', validFrom: '2027-06-27', validTo: '2026-09-07' };
    expect(validate(ds, null).join()).toMatch(/period validFrom/);
    ds.period = { name: 'Invierno 2026/2027', validFrom: '2026-09-07', validTo: '2027-06-27' };
    expect(validate(ds, null)).toEqual([]);
  });

  it('rejects a trip note with a time that is not in the finder', () => {
    const ds = makeDataset();
    ds.lines[0].notes = { lab: [{ mark: 'a', text: 'Paso por X', times: { '101': '09:00' } }], sab: [], fes: [] };
    expect(validate(ds, null)).toEqual([]);
    ds.lines[0].notes.lab[0].times = { '101': '09:01' };
    expect(validate(ds, null).join()).toMatch(/09:01 is not a time of stop 101/);
  });

  it('rejects invalid notices', () => {
    const ds = makeDataset();
    ds.notices = [{ id: 'huelga', from: '2026-11-01', to: '2026-11-03', es: 'Hola', en: 'Hi' }];
    expect(validate(ds, null)).toEqual([]);
    ds.notices = [{ id: 'huelga', from: '2026-11-05', to: '2026-11-03', es: 'Hola', en: 'Hi' }];
    expect(validate(ds, null).join()).toMatch(/notice #0/);
    ds.notices = [{ id: 'x', from: '1/11/2026', to: '2026-11-03', es: 'Hola', en: 'Hi' }];
    expect(validate(ds, null).join()).toMatch(/invalid "from"/);
  });
});
