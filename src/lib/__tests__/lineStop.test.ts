// Prueba de findLineStop: solo vale una parada que exista Y pertenezca a la línea.
import type { Dataset } from '@/data/schema';

import { findLineStop } from '../lineStop';

const stop = (code: string) => ({ code, name: `Parada ${code}`, description: '', lat: 0, lon: 0, coordSource: 'kml' as const });
const data: Dataset = {
  schemaVersion: 1,
  generatedAt: '',
  holidays: [],
  stops: { '1': stop('1'), '2': stop('2') },
  lines: [
    { id: 'A', name: 'A', colour: '#fff', stopCodes: ['1'], directions: [], shapes: [], timesByStop: {}, trips: { lab: [], sab: [], fes: [] } },
  ],
};

describe('findLineStop', () => {
  it('devuelve línea y parada si la parada es de la línea', () => {
    expect(findLineStop(data, 'A', '1')?.stop.code).toBe('1');
  });
  it('devuelve null si la parada existe pero no es de la línea', () => {
    expect(findLineStop(data, 'A', '2')).toBeNull();
  });
  it('devuelve null si la línea no existe', () => {
    expect(findLineStop(data, 'Z', '1')).toBeNull();
  });
});
