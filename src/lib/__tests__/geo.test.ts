// Pruebas de las funciones de distancia y tiempo andando (src/lib/geo.ts).
import { distanceMeters, walkingMinutes } from '@/lib/geo';

describe('distanceMeters', () => {
  it('Plaza Esteve a Villamarta está entre 215 y 235 m', () => {
    const esteve = { lat: 36.681745, lon: -6.136679 };
    const villamarta = { lat: 36.683371, lon: -6.135114 };
    const d = distanceMeters(esteve, villamarta);
    expect(d).toBeGreaterThanOrEqual(215);
    expect(d).toBeLessThanOrEqual(235);
  });
  it('el mismo punto está a 0 m', () => {
    expect(distanceMeters({ lat: 36.68, lon: -6.13 }, { lat: 36.68, lon: -6.13 })).toBe(0);
  });
});

describe('walkingMinutes', () => {
  it('mínimo 1 minuto', () => {
    expect(walkingMinutes(0)).toBe(1);
    expect(walkingMinutes(80)).toBe(1);
  });
  it('redondea hacia arriba cada 80 m', () => {
    expect(walkingMinutes(81)).toBe(2);
    expect(walkingMinutes(400)).toBe(5);
  });
});
