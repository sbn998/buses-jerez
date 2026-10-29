// Pruebas de las paradas cercanas (src/lib/nearby.ts): radio, orden, respaldo y líneas.
import type { Dataset, Line, Stop } from '@/data/schema';
import { nearbyStops } from '@/lib/nearby';

// Punto de partida: en 1 grado de latitud hay unos 111 195 m, así que
// `norte(m)` deja una coordenada a `m` metros al norte del origen.
const ORIGEN = { lat: 36.68, lon: -6.13 };
const norte = (m: number) => ({ lat: ORIGEN.lat + m / 111195, lon: ORIGEN.lon });

const parada = (code: string, punto: { lat: number; lon: number }): Stop => ({
  code,
  name: `Parada ${code}`,
  description: '',
  lat: punto.lat,
  lon: punto.lon,
  coordSource: 'kml',
});

const linea = (id: string, stopCodes: string[]): Line => ({
  id,
  name: `Línea ${id}`,
  colour: '#fff',
  stopCodes,
  directions: [],
  shapes: [],
  timesByStop: {},
  trips: { lab: [], sab: [], fes: [] },
});

const dataset = (stops: Stop[], lines: Line[]): Dataset => ({
  schemaVersion: 1,
  generatedAt: '',
  holidays: [],
  stops: Object.fromEntries(stops.map((s) => [s.code, s])),
  lines,
});

describe('nearbyStops', () => {
  it('devuelve las paradas dentro del radio, ordenadas por distancia', () => {
    const data = dataset(
      [parada('A', norte(900)), parada('B', norte(100)), parada('C', norte(300))],
      [linea('1', ['A', 'B', 'C'])],
    );
    const r = nearbyStops(data, ORIGEN);
    expect(r.withinRadius).toBe(true);
    expect(r.items.map((i) => i.stop.code)).toEqual(['B', 'C']);
  });

  it('calcula metros y minutos de cada parada', () => {
    const data = dataset([parada('B', norte(100))], [linea('1', ['B'])]);
    const [item] = nearbyStops(data, ORIGEN).items;
    expect(item.meters).toBeGreaterThanOrEqual(99);
    expect(item.meters).toBeLessThanOrEqual(101);
    expect(item.minutes).toBe(2);
  });

  it('si no hay paradas en el radio, devuelve las 3 más cercanas con withinRadius false', () => {
    const data = dataset(
      [
        parada('A', norte(5000)),
        parada('B', norte(5200)),
        parada('C', norte(5100)),
        parada('D', norte(6000)),
      ],
      [linea('1', ['A', 'B', 'C', 'D'])],
    );
    const r = nearbyStops(data, ORIGEN);
    expect(r.withinRadius).toBe(false);
    expect(r.items.map((i) => i.stop.code)).toEqual(['A', 'C', 'B']);
  });

  it('ignora las paradas que no salen en ninguna línea', () => {
    const data = dataset(
      [parada('A', norte(50)), parada('B', norte(200))],
      [linea('1', ['B'])],
    );
    const r = nearbyStops(data, ORIGEN);
    expect(r.items.map((i) => i.stop.code)).toEqual(['B']);
  });

  it('sin paradas en ninguna línea devuelve una lista vacía', () => {
    const data = dataset([parada('A', norte(50))], []);
    expect(nearbyStops(data, ORIGEN)).toEqual({ items: [], withinRadius: false });
  });

  it('lines: líneas de la parada ordenadas por id numérico', () => {
    const data = dataset(
      [parada('A', norte(50))],
      [linea('10', ['A']), linea('2', ['A']), linea('7', ['X'])],
    );
    const [item] = nearbyStops(data, ORIGEN).items;
    expect(item.lines.map((l) => l.id)).toEqual(['2', '10']);
  });
});
