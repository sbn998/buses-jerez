// Pruebas del planificador de "Cómo llego" (src/lib/planner.ts).
// Usan un mapa inventado y pequeño: 8 paradas y 3 líneas cerca de Jerez.
import type { Dataset, DayType, Line, Stop, TimeOfDay } from '@/data/schema';
import { walkingMinutes } from '@/lib/geo';
import {
  estimateWalk,
  legCoords,
  planTrips,
  sortOptions,
  type RouteOption,
} from '@/lib/planner';

// Un metro en grados de latitud (con el radio de la Tierra que usa geo.ts).
const GRADOS_POR_METRO = 180 / (Math.PI * 6371000);
const LAT0 = 36.68;
const LON0 = -6.13;

/** Punto a `norte` metros al norte y `este` metros al este del origen del mapa de prueba. */
function pt(norte: number, este: number) {
  return {
    lat: LAT0 + norte * GRADOS_POR_METRO,
    lon: LON0 + (este * GRADOS_POR_METRO) / Math.cos((LAT0 * Math.PI) / 180),
  };
}

function parada(code: string, norte: number, este: number): Stop {
  return {
    code,
    name: `Parada ${code}`,
    description: '',
    ...pt(norte, este),
    coordSource: 'kml',
  };
}

function linea(id: string, stopCodes: string[]): Line {
  return {
    id,
    name: `Línea ${id}`,
    colour: '#123456',
    stopCodes,
    directions: [{ headsign: 'Final', stopCodes }],
    shapes: [],
    timesByStop: {},
    trips: { lab: [], sab: [], fes: [] },
  };
}

/**
 * Mapa de prueba (norte, este en metros desde el origen):
 *  - Línea 1: P1 (0,0) -> P2 (2000,0) -> P3 (4000,0)
 *  - Línea 2: Q1 (2000,100) -> Q2 (2000,3000) -> Q3 (2000,6000)   (Q1 está a 100 m de P2)
 *  - Línea 3: P2 -> S2 (2000,-3000) -> S3 (2000,-6000)             (comparte P2 con la 1)
 * Las líneas nacen sin viajes: cada prueba pone los suyos.
 */
function mundo(): Dataset {
  const paradas = [
    parada('P1', 0, 0),
    parada('P2', 2000, 0),
    parada('P3', 4000, 0),
    parada('Q1', 2000, 100),
    parada('Q2', 2000, 3000),
    parada('Q3', 2000, 6000),
    parada('S2', 2000, -3000),
    parada('S3', 2000, -6000),
  ];
  const stops: Record<string, Stop> = {};
  for (const p of paradas) stops[p.code] = p;
  return {
    schemaVersion: 1,
    generatedAt: '2026-10-28T00:00:00Z',
    lines: [
      linea('1', ['P1', 'P2', 'P3']),
      linea('2', ['Q1', 'Q2', 'Q3']),
      linea('3', ['P2', 'S2', 'S3']),
    ],
    stops,
    holidays: [],
  };
}

const poner = (data: Dataset, id: string, dia: DayType, filas: (TimeOfDay | null)[][]) => {
  const l = data.lines.find((x) => x.id === id)!;
  l.trips[dia] = filas;
};

// 2026-10-28 es miércoles y 2026-11-01 es domingo (hora local).
const miercoles = (h: number, m: number) => new Date(2026, 9, 28, h, m);
const domingo = (h: number, m: number) => new Date(2026, 10, 1, h, m);

describe('estimateWalk', () => {
  it('multiplica por 1,3 la línea recta y calcula los minutos', () => {
    const w = estimateWalk(pt(0, 0), pt(100, 0));
    expect(w.meters).toBe(130);
    expect(w.minutes).toBe(walkingMinutes(130));
    expect(w.approximate).toBe(true);
  });
});

describe('planTrips', () => {
  it('direct trip uses first bus after walking', () => {
    const data = mundo();
    poner(data, '1', 'lab', [
      ['10:02', '10:10', '10:20'],
      ['10:10', '10:18', '10:28'],
    ]);
    // Origen a 200 m al oeste de P1 (4 min andando); destino justo en P3.
    const res = planTrips(data, pt(0, -200), pt(4000, 0), miercoles(10, 0));
    expect(res).toHaveLength(1);
    const op = res[0];
    expect(op.legs).toHaveLength(1);
    expect(op.legs[0].departure).toBe('10:10');
    expect(op.legs[0].arrival).toBe('10:28');
    expect(op.walkToStop.minutes).toBe(4);
    expect(op.firstWaitMinutes).toBe(6);
    expect(op.transferWalk).toBeNull();
    expect(op.transferWaitMinutes).toBeNull();
    // Llega a las 10:28 y anda 1 min (mínimo) hasta el destino.
    expect(op.arrivalMinutes).toBe(10 * 60 + 29);
    expect(op.totalMinutes).toBe(29);
    expect(op.walkMeters).toBe(op.walkToStop.meters + op.walkFromStop.meters);
    expect(op.id).toBe('1:P1>P3');
  });

  it('never rides backwards', () => {
    const data = mundo();
    poner(data, '1', 'lab', [['10:05', '10:15', '10:25']]);
    poner(data, '2', 'lab', [['10:05', '10:15', '10:25']]);
    poner(data, '3', 'lab', [['10:05', '10:15', '10:25']]);
    // Origen junto a P3 (última parada) y destino junto a P1 (primera).
    expect(planTrips(data, pt(4000, 0), pt(0, 0), miercoles(10, 0))).toEqual([]);
  });

  it('skips trips that start mid-route', () => {
    const data = mundo();
    poner(data, '1', 'lab', [
      [null, '10:10', '10:20'],
      ['10:30', '10:40', '10:50'],
    ]);
    const res = planTrips(data, pt(0, 0), pt(4000, 0), miercoles(10, 0));
    expect(res).toHaveLength(1);
    expect(res[0].legs[0].departure).toBe('10:30');
  });

  it('one transfer with minimum margin', () => {
    const data = mundo();
    poner(data, '1', 'lab', [['10:05', '10:20', '10:35']]);
    poner(data, '3', 'lab', [
      ['10:20', '10:35', '10:50'],
      ['10:30', '10:45', '11:00'],
    ]);
    // De P1 a S3: línea 1 hasta P2, y allí la línea 3.
    const res = planTrips(data, pt(0, 0), pt(2000, -6000), miercoles(10, 0));
    expect(res).toHaveLength(1);
    const op = res[0];
    expect(op.legs).toHaveLength(2);
    expect(op.legs[0].line.id).toBe('1');
    expect(op.legs[0].arrival).toBe('10:20');
    // La de las 10:20 sale justo cuando llega la primera: no hay margen, se toma la de las 10:30.
    expect(op.legs[1].departure).toBe('10:30');
    expect(op.transferWaitMinutes).toBe(10);
    expect(op.transferWalk).toBeNull();
    expect(op.id).toBe('1:P1>P2|3:P2>S3');
    expect(op.arrivalMinutes).toBe(11 * 60 + 1);
  });

  it('transfer to a nearby stop within 150 m', () => {
    const data = mundo();
    poner(data, '1', 'lab', [['10:05', '10:20', '10:35']]);
    poner(data, '2', 'lab', [
      ['10:21', '10:31', '10:41'],
      ['10:30', '10:40', '10:55'],
    ]);
    // Q1 está a 100 m de P2: andando 130 m (2 min) se llega a la línea 2.
    const res = planTrips(data, pt(0, 0), pt(2000, 6000), miercoles(10, 0));
    expect(res).toHaveLength(1);
    expect(res[0].legs[1].from.code).toBe('Q1');
    expect(res[0].transferWalk?.meters).toBe(130);
    expect(res[0].legs[1].departure).toBe('10:30');
    expect(res[0].transferWaitMinutes).toBe(8);

    // Con Q1 a 300 m de P2 ya no hay transbordo posible.
    data.stops.Q1 = parada('Q1', 2000, 300);
    expect(planTrips(data, pt(0, 0), pt(2000, 6000), miercoles(10, 0))).toEqual([]);
  });

  it('no trips left today', () => {
    const data = mundo();
    poner(data, '1', 'lab', [['10:05', '10:20', '10:35']]);
    expect(planTrips(data, pt(0, 0), pt(4000, 0), miercoles(23, 59))).toEqual([]);
  });

  it('uses holiday day type', () => {
    const data = mundo();
    poner(data, '1', 'lab', [['10:05', '10:10', '10:20']]);
    poner(data, '1', 'fes', [['10:15', '10:25', '10:35']]);
    const res = planTrips(data, pt(0, 0), pt(4000, 0), domingo(10, 0));
    expect(res).toHaveLength(1);
    expect(res[0].legs[0].departure).toBe('10:15');
  });

  it('falls back to nearest stops', () => {
    const data = mundo();
    poner(data, '1', 'lab', [['10:45', '10:55', '11:05']]);
    // Origen a 2 km al sur de toda parada: más lejos del radio de 800 m.
    const res = planTrips(data, pt(-2000, 0), pt(4000, 0), miercoles(10, 0));
    expect(res.length).toBeGreaterThanOrEqual(1);
    expect(res[0].legs[0].from.code).toBe('P1');
  });

  it('dedupes per line combination', () => {
    const data = mundo();
    data.stops.P1b = parada('P1b', 300, 0);
    data.lines[0].stopCodes = ['P1', 'P1b', 'P2', 'P3'];
    poner(data, '1', 'lab', [['10:05', '10:07', '10:20', '10:30']]);
    // Origen entre P1 y P1b: las dos sirven, pero sale una sola opción de la línea 1.
    const res = planTrips(data, pt(150, 0), pt(4000, 0), miercoles(10, 0));
    expect(res).toHaveLength(1);
  });

  it('keeps a transfer when only a later first bus connects within the wait limit', () => {
    const data = mundo();
    poner(data, '1', 'lab', [
      ['10:05', '10:20', '10:35'],
      ['10:45', '11:00', '11:15'],
    ]);
    poner(data, '3', 'lab', [['11:10', '11:25', '11:40']]);
    // Con el bus de las 10:20 habría que esperar 50 min; con el de las 11:00, solo 10.
    const res = planTrips(data, pt(0, 0), pt(2000, -6000), miercoles(10, 0));
    expect(res).toHaveLength(1);
    expect(res[0].legs[0].departure).toBe('10:45');
    expect(res[0].legs[0].arrival).toBe('11:00');
    expect(res[0].transferWaitMinutes).toBe(10);
    expect(res[0].legs[1].departure).toBe('11:10');
  });

  // Mundo con un directo lento (línea 1) y dos transbordos rápidos hacia P3.
  function mundoDirectoLento(): Dataset {
    const data = mundo();
    data.lines.push(linea('6', ['P2', 'P3']), linea('8', ['P1', 'P2']));
    poner(data, '1', 'lab', [['10:05', '10:30', '11:30']]);
    poner(data, '8', 'lab', [['10:05', '10:25']]);
    poner(data, '6', 'lab', [['10:40', '10:50']]);
    return data;
  }

  it('always keeps the best direct option even if it is not in the top maxResults', () => {
    const data = mundoDirectoLento();
    const res = planTrips(data, pt(0, 0), pt(4000, 0), miercoles(10, 0), { maxResults: 2 });
    expect(res).toHaveLength(2);
    expect(res.filter((r) => r.legs.length === 1).map((r) => r.id)).toEqual(['1:P1>P3']);
    expect(res.filter((r) => r.legs.length === 2)).toHaveLength(1);
    // Con espacio de sobra salen las cuatro combinaciones (1 directa y 3 con transbordo).
    expect(planTrips(data, pt(0, 0), pt(4000, 0), miercoles(10, 0))).toHaveLength(4);
  });

  it('respeta maxResults', () => {
    const data = mundo();
    expect(planTrips(data, pt(0, 0), pt(4000, 0), miercoles(10, 0), { maxResults: 0 })).toEqual([]);

    // Tres líneas directas P1 -> P3 con llegadas distintas: con maxResults 2 salen las 2 más rápidas.
    for (const [id, llega] of [['11', '10:40'], ['12', '10:30'], ['13', '10:50']]) {
      data.lines.push(linea(id, ['P1', 'P2', 'P3']));
      poner(data, id, 'lab', [['10:05', '10:15', llega]]);
    }
    const res = planTrips(data, pt(0, 0), pt(4000, 0), miercoles(10, 0), { maxResults: 2 });
    expect(res.map((r) => r.legs[0].line.id).sort()).toEqual(['11', '12']);
  });
});

describe('sortOptions', () => {
  const base = estimateWalk(pt(0, 0), pt(0, 0));
  // Una opción mínima, con solo los campos que usa la ordenación.
  const op = (id: string, arrivalMinutes: number, walkMeters: number, tramos: number) =>
    ({
      id,
      arrivalMinutes,
      walkMeters,
      legs: new Array(tramos).fill(null),
      walkToStop: base,
    }) as unknown as RouteOption;

  const a = op('a', 600, 500, 1);
  const b = op('b', 590, 900, 2);
  const c = op('c', 595, 300, 1);
  const ids = (l: RouteOption[]) => l.map((x) => x.id);

  it('ordena por llegada, andar y transbordos', () => {
    const lista = [a, b, c];
    expect(ids(sortOptions(lista, 'fastest'))).toEqual(['b', 'c', 'a']);
    expect(ids(sortOptions(lista, 'leastWalking'))).toEqual(['c', 'a', 'b']);
    expect(ids(sortOptions(lista, 'fewestTransfers'))).toEqual(['c', 'a', 'b']);
  });

  it('desempata fastest por metros andando y no toca la lista original', () => {
    const lista = [op('x', 590, 900, 1), op('y', 590, 400, 1)];
    expect(ids(sortOptions(lista, 'fastest'))).toEqual(['y', 'x']);
    expect(ids(lista)).toEqual(['x', 'y']);
  });
});

describe('legCoords', () => {
  it('devuelve [lon, lat] de la subida a la bajada, ambas incluidas', () => {
    const data = mundo();
    const l = data.lines[0];
    const leg = {
      line: l,
      from: data.stops.P1,
      to: data.stops.P3,
      fromIndex: 0,
      toIndex: 2,
      departure: '10:00',
      arrival: '10:20',
    };
    expect(legCoords(leg, data)).toEqual([
      [data.stops.P1.lon, data.stops.P1.lat],
      [data.stops.P2.lon, data.stops.P2.lat],
      [data.stops.P3.lon, data.stops.P3.lat],
    ]);
    expect(legCoords({ ...leg, fromIndex: 1, toIndex: 2 }, data)).toHaveLength(2);
  });
});
