// Pruebas del planificador de "Cómo llego" (src/lib/planner.ts).
// Usan un mapa inventado y pequeño: 8 paradas y 3 líneas cerca de Jerez.
import type { Dataset, DayType, Line, Stop, TimeOfDay } from '@/data/schema';
import { walkingMinutes } from '@/lib/geo';
import {
  candidateStops,
  estimateWalk,
  isApproximate,
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

  it('tries later B buses when the first connection waits too long', () => {
    const data = mundo();
    poner(data, '1', 'lab', [
      ['10:05', '10:20', '10:35'],
      ['11:15', '11:30', '11:45'],
    ]);
    poner(data, '3', 'lab', [
      ['11:10', '11:25', '11:40'],
      ['11:35', '11:50', '12:05'],
    ]);
    // Con el bus de A de las 10:20 la B de las 11:10 espera 50 min; con el de las 11:30,
    // la de las 11:10 ya se ha ido y la de las 11:35 espera solo 5.
    const res = planTrips(data, pt(0, 0), pt(2000, -6000), miercoles(10, 0));
    expect(res).toHaveLength(1);
    expect(res[0].legs[0].arrival).toBe('11:30');
    expect(res[0].legs[1].departure).toBe('11:35');
    expect(res[0].transferWaitMinutes).toBe(5);
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
    // Con espacio de sobra salen las no dominadas: el directo y los dos transbordos que llegan antes
    // (el cuarto, con transbordo y más tarde que otro igual, se descarta).
    expect(planTrips(data, pt(0, 0), pt(4000, 0), miercoles(10, 0))).toHaveLength(3);
  });

  it('quita las opciones dominadas: igual de rápidas pero con más tramos', () => {
    const data = mundo();
    data.lines.push(linea('X', ['P2', 'P3']));
    poner(data, '1', 'lab', [['10:05', '10:15', '10:30']]);
    poner(data, 'X', 'lab', [['10:16', '10:30']]);
    // 1|X llega igual que el directo 1 pero con un transbordo de más: sobra.
    const res = planTrips(data, pt(0, 0), pt(4000, 0), miercoles(10, 0));
    expect(res.map((r) => r.id)).toEqual(['1:P1>P3']);
  });

  it('deja una opción con transbordo si llega antes que el directo', () => {
    const data = mundo();
    data.lines.push(linea('X', ['P2', 'P3']), linea('Y', ['P2', 'P3']));
    poner(data, '1', 'lab', [['10:05', '10:15', '10:40']]);
    poner(data, 'X', 'lab', [['10:16', '10:30']]);
    poner(data, 'Y', 'lab', [['10:16', '10:25']]);
    const res = planTrips(data, pt(0, 0), pt(4000, 0), miercoles(10, 0));
    // X queda dominada por Y (llega antes con lo mismo); el directo llega tarde pero no tiene transbordo.
    expect(res.map((r) => r.id).sort()).toEqual(['1:P1>P2|Y:P2>P3', '1:P1>P3']);
  });

  it('respeta maxResults', () => {
    const data = mundo();
    expect(planTrips(data, pt(0, 0), pt(4000, 0), miercoles(10, 0), { maxResults: 0 })).toEqual([]);

    // Tres líneas directas que acaban en paradas distintas: la que llega antes anda más al destino y la
    // que llega después anda menos, así que ninguna domina a otra. Con maxResults 2 salen las 2 más rápidas.
    for (const [id, cod, este, llega] of [
      ['11', 'E1', 500, '10:30'],
      ['12', 'E2', 250, '10:40'],
      ['13', 'P3', 0, '10:50'],
    ] as const) {
      if (cod !== 'P3') data.stops[cod] = parada(cod, 4000, este);
      data.lines.push(linea(id, ['P1', 'P2', cod]));
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

describe('distancias reales (walks)', () => {
  const horarios = () => {
    const data = mundo();
    poner(data, '1', 'lab', [['10:02', '10:10', '10:20'], ['10:10', '10:18', '10:28']]);
    return data;
  };

  it('usa los metros reales del origen y recalcula la llegada', () => {
    const data = horarios();
    const sin = planTrips(data, pt(0, -200), pt(4000, 0), miercoles(10, 0))[0];
    const con = planTrips(data, pt(0, -200), pt(4000, 0), miercoles(10, 0), {
      walks: { fromOrigin: { P1: 420 } },
    })[0];
    expect(con.walkToStop).toEqual({ meters: 420, minutes: walkingMinutes(420), approximate: false });
    // Sin real: 4 min andando (llega 10:04, sube a las 10:10). Con real: 6 min (sube a las 10:10).
    expect(sin.firstWaitMinutes).toBe(6);
    expect(con.firstWaitMinutes).toBe(4);
    expect(con.walkFromStop.approximate).toBe(true);
    expect(con.walkMeters).toBe(420 + con.walkFromStop.meters);
  });

  it('usa los metros reales del destino en la llegada', () => {
    const data = horarios();
    const con = planTrips(data, pt(0, 0), pt(4000, -200), miercoles(10, 0), {
      walks: { toDestination: { P3: 800 } },
    })[0];
    expect(con.walkFromStop).toEqual({ meters: 800, minutes: 10, approximate: false });
    expect(con.arrivalMinutes).toBe(10 * 60 + 20 + 10);
  });

  it('un paseo real mas largo hace perder el bus que la estimacion alcanzaba', () => {
    const data = mundo();
    poner(data, '1', 'lab', [['10:04', '10:12', '10:22'], ['10:20', '10:28', '10:38']]);
    const orig = pt(0, -200); // estimacion: 260 m = 4 min, llega a las 10:04 y alcanza el primero
    const sin = planTrips(data, orig, pt(4000, 0), miercoles(10, 0))[0];
    expect(sin.legs[0].departure).toBe('10:04');
    const con = planTrips(data, orig, pt(4000, 0), miercoles(10, 0), {
      walks: { fromOrigin: { P1: 480 } }, // 6 min: ya no llega al de las 10:04
    })[0];
    expect(con.legs[0].departure).toBe('10:20');
    expect(con.arrivalMinutes).toBeGreaterThan(sin.arrivalMinutes);
  });

  it('sin walks sale igual que antes', () => {
    const data = horarios();
    const a = planTrips(data, pt(0, -200), pt(4000, 0), miercoles(10, 0));
    const b = planTrips(data, pt(0, -200), pt(4000, 0), miercoles(10, 0), { walks: {} });
    expect(b).toEqual(a);
  });
});

describe('candidateStops', () => {
  it('coincide con las paradas que usa planTrips', () => {
    const data = mundo();
    poner(data, '1', 'lab', [['10:10', '10:18', '10:28']]);
    const origen = pt(0, -200);
    const cand = candidateStops(data, origen).map((s) => s.code);
    expect(cand).toContain('P1');
    // Con el viaje de P1 a P3, el tramo andando usa una de las candidatas.
    const op = planTrips(data, origen, pt(4000, 0), miercoles(10, 0))[0];
    expect(cand).toContain(op.legs[0].from.code);
    // Sin ninguna en el radio, se usan las 3 más cercanas.
    expect(candidateStops(data, pt(0, 50000))).toHaveLength(3);
    // Respeta las opciones.
    expect(candidateStops(data, origen, { maxStopsPerEnd: 1 })).toHaveLength(1);
  });
});

describe('isApproximate', () => {
  const real = { meters: 100, minutes: 2, approximate: false };
  const estim = { meters: 100, minutes: 2, approximate: true };
  const base = { walkToStop: real, walkFromStop: real, transferWalk: null } as unknown as RouteOption;
  it('es false solo si todos los tramos son reales', () => {
    expect(isApproximate(base)).toBe(false);
    expect(isApproximate({ ...base, walkToStop: estim })).toBe(true);
    expect(isApproximate({ ...base, walkFromStop: estim })).toBe(true);
    expect(isApproximate({ ...base, transferWalk: estim })).toBe(true);
    expect(isApproximate({ ...base, transferWalk: real })).toBe(false);
  });
});
