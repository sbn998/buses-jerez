// Pruebas de la reconstrucción de viajes: qué hora de cada parada corresponde al mismo autobús.
import { describe, expect, it } from 'vitest';
import { buildTrips } from '../src/trips';

describe('buildTrips', () => {
  it('mid-route start', () => {
    expect(
      buildTrips(['A', 'B', 'C'], { A: ['07:28'], B: ['07:10', '07:29'], C: ['07:11', '07:30'] }),
    ).toEqual([
      [null, '07:10', '07:11'],
      ['07:28', '07:29', '07:30'],
    ]);
  });

  it('early end', () => {
    expect(
      buildTrips(['A', 'B', 'C'], { A: ['21:00', '21:30'], B: ['21:02', '21:32'], C: ['21:04'] }),
    ).toEqual([
      ['21:00', '21:02', '21:04'],
      ['21:30', '21:32', null],
    ]);
  });

  it('gap too big starts new trip', () => {
    expect(buildTrips(['A', 'B'], { A: ['10:00'], B: ['10:40'] })).toEqual([
      ['10:00', null],
      [null, '10:40'],
    ]);
  });

  it('real line 1 sample', () => {
    const trips = buildTrips(['343', '453', '128'], {
      '343': ['07:28', '07:45'],
      '453': ['07:29', '07:46'],
      '128': ['07:10', '07:25', '07:41', '07:58'],
    });
    expect(trips).toHaveLength(4);
    expect(trips[0]).toEqual([null, null, '07:10']);
    expect(trips[1]).toEqual([null, null, '07:25']);
    expect(trips[2]).toEqual(['07:28', '07:29', '07:41']);
  });
});
