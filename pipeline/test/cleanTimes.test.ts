// Pruebas de la limpieza de horas: Comujesa a veces da horas desordenadas o de relleno ("00:01").
import { describe, expect, it } from 'vitest';
import { cleanTimes } from '../src/cleanTimes';

describe('cleanTimes', () => {
  it('leaves an ordered list untouched', () => {
    expect(cleanTimes(['07:28', '07:45', '08:06'])).toEqual({ times: ['07:28', '07:45', '08:06'], issues: [] });
  });

  it('drops a placeholder time far earlier than the previous ones', () => {
    const r = cleanTimes(['12:54', '13:49', '00:01', '15:14']);
    expect(r.times).toEqual(['12:54', '13:49', '15:14']);
    expect(r.issues).toEqual(['dropped 00:01 (out of sequence)']);
  });

  it('keeps a second run of real times when the bus passes the stop twice', () => {
    // Parada 74 de la línea 2: Comujesa da primero una pasada y después la otra.
    const first = ['07:11', '07:59', '08:48', '09:43', '10:38', '11:34', '12:28', '13:23', '14:49', '15:37', '16:53', '17:39', '18:27', '19:16', '20:06', '20:56'];
    const second = ['07:13', '08:01', '08:50', '09:45', '10:40', '11:36', '12:30', '13:25', '14:51', '15:39', '16:55', '17:41', '18:29', '19:18', '20:08', '20:58'];
    const r = cleanTimes([...first, ...second]);
    expect(r.times).toHaveLength(32);
    expect(r.times.slice(0, 4)).toEqual(['07:11', '07:13', '07:59', '08:01']);
    expect(r.issues).toEqual(['reordered']);
  });

  it('sorts times that are slightly out of order', () => {
    const r = cleanTimes(['14:27', '16:30', '15:50', '16:35']);
    expect(r.times).toEqual(['14:27', '15:50', '16:30', '16:35']);
    expect(r.issues).toEqual(['reordered']);
  });
});
