// Pruebas de la comprobación anual de festivos locales.
import { describe, expect, it } from 'vitest';
import { missingLocalYears } from '../src/checkHolidays';

const local = { '2026': [{ date: '2026-05-11', name: 'x' }, { date: '2026-09-24', name: 'y' }] };

describe('missingLocalYears', () => {
  it('only needs the current year before October', () => {
    expect(missingLocalYears(local, new Date('2026-09-30T12:00:00Z'))).toEqual([]);
  });

  it('from October also needs next year', () => {
    expect(missingLocalYears(local, new Date('2026-10-01T12:00:00Z'))).toEqual([2027]);
  });

  it('reports the current year when it is missing', () => {
    expect(missingLocalYears({}, new Date('2027-02-01T12:00:00Z'))).toEqual([2027]);
  });

  it('a year with only one holiday still counts as missing', () => {
    expect(missingLocalYears({ '2027': [{ date: '2027-05-01', name: 'x' }] }, new Date('2027-03-01T12:00:00Z'))).toEqual([2027]);
  });
});
