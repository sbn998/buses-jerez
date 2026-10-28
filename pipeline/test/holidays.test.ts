// Pruebas de los festivos: nacionales, de Andalucía y locales de Jerez.
import { describe, expect, it } from 'vitest';
import { buildHolidays } from '../src/holidays';

const nager = [
  { date: '2026-01-01', localName: 'Año Nuevo', global: true, counties: null },
  { date: '2026-02-28', localName: 'Día de Andalucía', global: false, counties: ['ES-AN'] },
  { date: '2026-05-02', localName: 'Fiesta de la Comunidad de Madrid', global: false, counties: ['ES-MD'] },
];

describe('buildHolidays', () => {
  it('classifies national and regional and drops other regions', () => {
    const { holidays } = buildHolidays(nager, {}, [2026]);
    expect(holidays).toEqual([
      { date: '2026-01-01', name: 'Año Nuevo', scope: 'national' },
      { date: '2026-02-28', name: 'Día de Andalucía', scope: 'regional' },
    ]);
  });

  it('adds local holidays and warns about years without them', () => {
    const local = { '2026': [{ date: '2026-10-09', name: 'San Dionisio' }] };
    const { holidays, warnings } = buildHolidays(nager, local, [2026, 2027]);
    expect(holidays).toContainEqual({ date: '2026-10-09', name: 'San Dionisio', scope: 'local' });
    expect(warnings).toEqual(['no local holidays for 2027']);
  });

  it('keeps one entry per date with local first and sorts by date', () => {
    const local = { '2026': [{ date: '2026-02-28', name: 'Local' }] };
    const { holidays } = buildHolidays(nager, local, [2026]);
    expect(holidays).toEqual([
      { date: '2026-01-01', name: 'Año Nuevo', scope: 'national' },
      { date: '2026-02-28', name: 'Local', scope: 'local' },
    ]);
  });

  it('emits extra regional holidays (moved to Monday) as regional', () => {
    const extra = { '2026': [{ date: '2026-11-02', name: 'Todos los Santos (trasladado)' }] };
    const { holidays } = buildHolidays(nager, {}, [2026], extra);
    expect(holidays).toContainEqual({ date: '2026-11-02', name: 'Todos los Santos (trasladado)', scope: 'regional' });
  });

  it('local still wins over an extra regional holiday on the same date', () => {
    const local = { '2026': [{ date: '2026-11-02', name: 'Local' }] };
    const extra = { '2026': [{ date: '2026-11-02', name: 'Todos los Santos (trasladado)' }] };
    const { holidays } = buildHolidays(nager, local, [2026], extra);
    expect(holidays.filter((h) => h.date === '2026-11-02')).toEqual([
      { date: '2026-11-02', name: 'Local', scope: 'local' },
    ]);
  });
});
