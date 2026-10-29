// Pruebas de los puntos de recarga: lectura del archivo, detección del cartel nuevo y validación.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadTopUp, posterImageFromPage, topUpPosterChanged } from '../src/topup';
import { validate } from '../src/validate';
import type { Dataset, Line } from '../../src/data/schema';

const html = `<html><body>
  <img src="/fileadmin/logo.png">
  <img src="/fileadmin/_processed_/3/9/csm_RedVenta_6caee5bb75.jpg" alt="cartel">
  <img src="/fileadmin/_processed_/1/1/csm_RedVenta_otro.jpg">
</body></html>`;
const POSTER = '/fileadmin/_processed_/3/9/csm_RedVenta_6caee5bb75.jpg';
const real = JSON.parse(readFileSync(new URL('../topup-points.json', import.meta.url), 'utf8'));

describe('posterImageFromPage', () => {
  it('devuelve la primera imagen cuyo nombre contiene RedVenta', () => {
    expect(posterImageFromPage(html)).toBe(POSTER);
  });
  it('devuelve null si no hay cartel', () => {
    expect(posterImageFromPage('<img src="/a.png">')).toBeNull();
  });
});

describe('topUpPosterChanged', () => {
  it('false con la misma ruta, true con otra', () => {
    expect(topUpPosterChanged(html, POSTER)).toBe(false);
    expect(topUpPosterChanged(html, '/fileadmin/csm_RedVenta_viejo.jpg')).toBe(true);
  });
  it('false si la página no trae cartel (no se avisa por una página rota)', () => {
    expect(topUpPosterChanged('<p>nada</p>', POSTER)).toBe(false);
  });
});

describe('loadTopUp', () => {
  it('lee los 30 puntos del archivo real, 2 de ellos oficinas', () => {
    const points = loadTopUp(real);
    expect(points).toHaveLength(30);
    expect(points.filter((p) => p.zone === 'oficina')).toHaveLength(2);
  });
});

describe('validate con topUpPoints', () => {
  function dataset(): Dataset {
    const times = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
    const stops: Dataset['stops'] = {};
    const lines: Line[] = [];
    for (let i = 1; i <= 18; i++) {
      const codes = [`${i}01`, `${i}02`];
      codes.forEach((code, j) => {
        stops[code] = { code, name: 'P' + code, description: '', lat: 36.6 + i * 0.01, lon: -6.2 + j * 0.01, coordSource: 'kml' };
      });
      lines.push({
        id: String(i), name: 'L' + i, colour: '#000000', stopCodes: codes,
        directions: [{ headsign: 'X', stopCodes: codes }],
        shapes: [[[-6.13, 36.68], [-6.14, 36.69]]],
        timesByStop: Object.fromEntries(codes.map((c) => [c, { lab: [...times], sab: [], fes: [] }])),
        trips: { lab: [], sab: [], fes: [] },
      });
    }
    return { schemaVersion: 1, generatedAt: '2026-10-28T00:00:00Z', lines, stops, holidays: [] };
  }

  it('acepta los puntos reales', () => {
    expect(validate({ ...dataset(), topUpPoints: loadTopUp(real), topUpChecked: real.checked }, null)).toEqual([]);
  });
  it('exige topUpChecked cuando hay puntos, y que sea una fecha AAAA-MM-DD real', () => {
    const ok = { name: 'A', address: 'B', zone: 'centro' as const };
    const withPoints = { ...dataset(), topUpPoints: [ok] };
    expect(validate(withPoints, null).join()).toMatch(/topUpChecked/);
    expect(validate({ ...withPoints, topUpChecked: '29/10/2026' }, null).join()).toMatch(/topUpChecked/);
    expect(validate({ ...withPoints, topUpChecked: '2026-02-30' }, null).join()).toMatch(/topUpChecked/);
    expect(validate({ ...withPoints, topUpChecked: '2026-10-29' }, null)).toEqual([]);
    // Una fecha mal puesta se rechaza aunque no haya puntos.
    expect(validate({ ...dataset(), topUpChecked: 'ayer' }, null).join()).toMatch(/topUpChecked/);
  });
  it('acepta datos sin topUpPoints', () => {
    expect(validate(dataset(), null)).toEqual([]);
  });
  it('rechaza una lista vacía, un punto sin dirección, sin nombre o con zona inválida', () => {
    expect(validate({ ...dataset(), topUpPoints: [] }, null).join()).toMatch(/top-up/);
    const ok = { name: 'A', address: 'B', zone: 'centro' as const };
    expect(validate({ ...dataset(), topUpPoints: [{ ...ok, address: ' ' }] }, null).join()).toMatch(/top-up.*address/);
    expect(validate({ ...dataset(), topUpPoints: [{ ...ok, name: '' }] }, null).join()).toMatch(/top-up.*name/);
    expect(validate({ ...dataset(), topUpPoints: [{ ...ok, zone: 'luna' as never }] }, null).join()).toMatch(/top-up.*zone/);
  });
});
