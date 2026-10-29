// Planificador de "Cómo llego": dado un origen, un destino y la hora de ahora, busca
// cómo ir en autobús (directo o con 1 transbordo) usando solo los horarios de hoy.
// Es lógica pura: no hay pantallas ni red, así que funciona sin internet y se puede probar.
// Los metros andando son una estimación (línea recta × 1,3), por eso van marcados como aproximados.
import type { Dataset, Line, Stop, TimeOfDay } from '@/data/schema';
import { distanceMeters, walkingMinutes } from '@/lib/geo';
import { dayTypeFor, minutesOfDay } from '@/lib/schedule';

/** Un punto del mapa. */
export type LatLon = { lat: number; lon: number };

/** Un trozo andando: siempre es una estimación, nunca una medida exacta. */
export interface WalkEstimate {
  meters: number;
  minutes: number;
  approximate: true;
}

/** Un tramo en bus: se sube en `from` (índice `fromIndex` de la línea) y se baja en `to`. */
export interface BusLeg {
  line: Line;
  from: Stop;
  to: Stop;
  fromIndex: number;
  toIndex: number;
  departure: TimeOfDay;
  arrival: TimeOfDay;
}

/** Una forma completa de llegar: andar, bus, (andar, bus), andar. */
export interface RouteOption {
  /** Identifica la opción, por ejemplo "4:343>12|18:12>55". */
  id: string;
  /** 1 o 2 tramos en bus. */
  legs: BusLeg[];
  walkToStop: WalkEstimate;
  /** Andando entre las dos paradas del transbordo; null si es en la misma parada o no hay transbordo. */
  transferWalk: WalkEstimate | null;
  walkFromStop: WalkEstimate;
  /** Minutos de espera en la primera parada (desde que llegas andando hasta que sale el bus). */
  firstWaitMinutes: number;
  /** Minutos de espera en el transbordo (null si no hay transbordo). */
  transferWaitMinutes: number | null;
  /** Hora de llegada al destino, en minutos desde la medianoche. */
  arrivalMinutes: number;
  /** Minutos desde ahora hasta llegar al destino. */
  totalMinutes: number;
  /** Suma de todo lo que se anda (metros, aproximado). */
  walkMeters: number;
}

export type SortMode = 'fastest' | 'leastWalking' | 'fewestTransfers';

/** Valores por defecto del planificador. */
export const PLANNER_DEFAULTS = {
  /** Distancia máxima en línea recta para considerar una parada a pie. */
  maxWalkMeters: 800,
  /** Si no hay ninguna parada en ese radio, cuántas de las más cercanas se usan. */
  fallbackStops: 3,
  /** Máximo de paradas candidatas en cada extremo. */
  maxStopsPerEnd: 8,
  /** Distancia máxima entre la parada de bajada y la de subida de un transbordo. */
  transferRadiusMeters: 150,
  /** Margen mínimo (minutos) para hacer un transbordo. */
  minTransferMinutes: 1,
  /** Espera máxima aceptada en un transbordo. */
  maxTransferWaitMinutes: 40,
  /** Máximo de opciones que devuelve el planificador. */
  maxResults: 6,
  /** Las calles no son una línea recta: se multiplica por este factor. */
  detourFactor: 1.3,
};

/** Estima el paseo entre dos puntos: línea recta × `detourFactor`, y minutos a 80 m/min. */
export function estimateWalk(
  a: LatLon,
  b: LatLon,
  detourFactor = PLANNER_DEFAULTS.detourFactor,
): WalkEstimate {
  const meters = Math.round(distanceMeters(a, b) * detourFactor);
  return { meters, minutes: walkingMinutes(meters), approximate: true };
}

// Una parada candidata en un extremo del viaje, con lo que cuesta llegar a ella andando.
interface Candidate {
  stop: Stop;
  walk: WalkEstimate;
}

// Dónde sale una parada: en qué línea (posición en data.lines) y en qué índice de su recorrido.
interface Visit {
  lineIdx: number;
  index: number;
}

// Un viaje elegido dentro de una línea: fila de `trips` y minutos de salida y llegada.
interface Ride {
  row: number;
  dep: number;
  arr: number;
}

/**
 * Busca cómo llegar de `from` a `to` saliendo ahora, solo con los viajes que quedan hoy.
 * Devuelve como mucho una opción por combinación de líneas (la que llega antes) y
 * `maxResults` en total, sin un orden concreto (usa `sortOptions` para ordenarlas).
 */
export function planTrips(
  data: Dataset,
  from: LatLon,
  to: LatLon,
  now: Date,
  options: Partial<typeof PLANNER_DEFAULTS> = {},
): RouteOption[] {
  const o = { ...PLANNER_DEFAULTS, ...options };
  const dayType = dayTypeFor(now, data.holidays);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Las horas de hoy de cada línea pasadas a minutos (null = ese bus no pasa por esa parada).
  const rowsByLine = data.lines.map((l) =>
    l.trips[dayType].map((row) => row.map((c) => (c === null ? null : minutesOfDay(c)))),
  );

  // Índice: código de parada -> en qué líneas y posiciones aparece.
  const visits = new Map<string, Visit[]>();
  data.lines.forEach((line, lineIdx) => {
    line.stopCodes.forEach((code, index) => {
      if (!data.stops[code]) return;
      const lista = visits.get(code) ?? [];
      lista.push({ lineIdx, index });
      visits.set(code, lista);
    });
  });

  /** Paradas candidatas cerca de un punto; si no hay ninguna en el radio, las más cercanas. */
  function candidates(point: LatLon): Candidate[] {
    const todas: { stop: Stop; d: number }[] = [];
    for (const code of visits.keys()) {
      const stop = data.stops[code];
      todas.push({ stop, d: distanceMeters(point, stop) });
    }
    todas.sort((a, b) => a.d - b.d);
    const cerca = todas.filter((x) => x.d <= o.maxWalkMeters).slice(0, o.maxStopsPerEnd);
    const elegidas = cerca.length > 0 ? cerca : todas.slice(0, o.fallbackStops);
    return elegidas.map((x) => ({ stop: x.stop, walk: estimateWalk(point, x.stop, o.detourFactor) }));
  }

  // Memoria de bestRide: la misma consulta se repite muchas veces entre candidatas.
  const rideCache = new Map<number, Ride | null>();

  /**
   * El mejor viaje entre dos posiciones de una línea: sale a partir de `minDepart`, con las
   * dos horas puestas y la de bajada igual o posterior. Gana la llegada más temprana.
   */
  function bestRide(lineIdx: number, i: number, j: number, minDepart: number): Ride | null {
    const key = ((lineIdx * 1024 + i) * 1024 + j) * 4096 + minDepart;
    const guardado = rideCache.get(key);
    if (guardado !== undefined) return guardado;
    let best: Ride | null = null;
    rowsByLine[lineIdx].forEach((row, r) => {
      const dep = row[i];
      const arr = row[j];
      if (dep === null || arr === null || dep < minDepart || arr < dep) return;
      if (!best || arr < best.arr || (arr === best.arr && dep > best.dep)) best = { row: r, dep, arr };
    });
    rideCache.set(key, best);
    return best;
  }

  /**
   * Como bestRide, pero eligiendo el viaje que llega más tarde sin pasar de `maxArrive`.
   * Sirve para el primer bus de un transbordo cuando el más temprano esperaría demasiado.
   */
  function lastRideBefore(
    lineIdx: number,
    i: number,
    j: number,
    minDepart: number,
    maxArrive: number,
  ): Ride | null {
    let best: Ride | null = null;
    rowsByLine[lineIdx].forEach((row, r) => {
      const dep = row[i];
      const arr = row[j];
      if (dep === null || arr === null || dep < minDepart || arr < dep || arr > maxArrive) return;
      if (!best || arr > best.arr || (arr === best.arr && dep > best.dep)) best = { row: r, dep, arr };
    });
    return best;
  }

  /** Construye un tramo en bus a partir de un viaje elegido. */
  function makeLeg(lineIdx: number, i: number, j: number, ride: Ride): BusLeg {
    const line = data.lines[lineIdx];
    const fila = line.trips[dayType][ride.row];
    return {
      line,
      from: data.stops[line.stopCodes[i]],
      to: data.stops[line.stopCodes[j]],
      fromIndex: i,
      toIndex: j,
      departure: fila[i] as TimeOfDay,
      arrival: fila[j] as TimeOfDay,
    };
  }

  // Las paradas que tienen alguna línea, en una lista para recorrerlas rápido.
  const servedStops = [...visits.keys()].map((c) => data.stops[c]);

  // Paradas cercanas a un transbordo (la misma parada con paseo null, y las que estén a ≤ radio).
  const transferCache = new Map<string, { stop: Stop; walk: WalkEstimate | null }[]>();
  function transferStops(code: string): { stop: Stop; walk: WalkEstimate | null }[] {
    const guardado = transferCache.get(code);
    if (guardado) return guardado;
    const aqui = data.stops[code];
    const lista: { stop: Stop; walk: WalkEstimate | null }[] = [{ stop: aqui, walk: null }];
    // Filtro barato antes de calcular la distancia exacta: caja de ±radio en grados.
    const dLat = o.transferRadiusMeters / 111000 + 1e-6;
    const dLon = dLat / Math.max(0.1, Math.cos((aqui.lat * Math.PI) / 180));
    for (const stop of servedStops) {
      if (stop.code === code) continue;
      if (Math.abs(stop.lat - aqui.lat) > dLat || Math.abs(stop.lon - aqui.lon) > dLon) continue;
      if (distanceMeters(aqui, stop) <= o.transferRadiusMeters) {
        lista.push({ stop, walk: estimateWalk(aqui, stop, o.detourFactor) });
      }
    }
    transferCache.set(code, lista);
    return lista;
  }

  const origins = candidates(from);
  const dests = candidates(to);

  // Para el lado del destino: por línea, dónde se puede bajar (parada candidata e índice).
  const destByLine = new Map<number, { dst: Candidate; index: number }[]>();
  for (const dst of dests) {
    for (const v of visits.get(dst.stop.code) ?? []) {
      const lista = destByLine.get(v.lineIdx) ?? [];
      lista.push({ dst, index: v.index });
      destByLine.set(v.lineIdx, lista);
    }
  }

  // Una opción por combinación de líneas: nos quedamos con la que llega antes.
  // La clave es numérica (línea A * 100 + línea B + 1; 0 en B si no hay transbordo) para ir rápido.
  const best = new Map<number, RouteOption>();
  const comboKey = (lineA: number, lineB: number) => (lineA + 1) * 1000 + (lineB + 1);
  /** ¿Mejoraría una opción con esta llegada y estos metros a la que ya tenemos para la combinación? */
  function improves(key: number, arrivalMinutes: number, walkMeters: number): boolean {
    const actual = best.get(key);
    return (
      !actual ||
      arrivalMinutes < actual.arrivalMinutes ||
      (arrivalMinutes === actual.arrivalMinutes && walkMeters < actual.walkMeters)
    );
  }

  const legId = (l: BusLeg) => `${l.line.id}:${l.from.code}>${l.to.code}`;

  for (const org of origins) {
    const minBoard = nowMinutes + org.walk.minutes;

    for (const va of visits.get(org.stop.code) ?? []) {
      const lineA = data.lines[va.lineIdx];

      // Viaje directo: bajar en alguna parada candidata del destino de la misma línea.
      for (const { dst, index: jd } of destByLine.get(va.lineIdx) ?? []) {
        if (jd <= va.index) continue;
        const ride = bestRide(va.lineIdx, va.index, jd, minBoard);
        if (!ride) continue;
        const arrivalMinutes = ride.arr + dst.walk.minutes;
        const walkMeters = org.walk.meters + dst.walk.meters;
        const dkey = comboKey(va.lineIdx, -1);
        if (!improves(dkey, arrivalMinutes, walkMeters)) continue;
        const leg = makeLeg(va.lineIdx, va.index, jd, ride);
        best.set(dkey, {
          id: legId(leg),
          legs: [leg],
          walkToStop: org.walk,
          transferWalk: null,
          walkFromStop: dst.walk,
          firstWaitMinutes: ride.dep - minBoard,
          transferWaitMinutes: null,
          arrivalMinutes,
          totalMinutes: arrivalMinutes - nowMinutes,
          walkMeters,
        });
      }

      // Un transbordo: bajar en `k` y subir a otra línea en la misma parada o en una cercana.
      for (let k = va.index + 1; k < lineA.stopCodes.length; k++) {
        if (!data.stops[lineA.stopCodes[k]]) continue;
        const rideA = bestRide(va.lineIdx, va.index, k, minBoard);
        if (!rideA) continue;

        for (const t of transferStops(lineA.stopCodes[k])) {
          const walkMin = t.walk ? t.walk.minutes : 0;
          const ready = rideA.arr + walkMin; // hora en que estamos listos en la parada de B
          const minDep = ready + o.minTransferMinutes;

          for (const vb of visits.get(t.stop.code) ?? []) {
            if (vb.lineIdx === va.lineIdx) continue;
            // Si la línea B no llega a ningún destino candidato, no sirve.
            const bajadas = destByLine.get(vb.lineIdx);
            if (!bajadas) continue;
            const key = comboKey(va.lineIdx, vb.lineIdx);
            for (const { dst, index: jd } of bajadas) {
              if (jd <= vb.index) continue;
              // Poda: ya hay una opción de esta combinación que llega igual o antes que lo mejor posible aquí.
              const conocida = best.get(key);
              if (conocida && conocida.arrivalMinutes < minDep + dst.walk.minutes) continue;

              const rideB = bestRide(vb.lineIdx, vb.index, jd, minDep);
              if (!rideB) continue;
              // Si con el primer bus de A habría que esperar demasiado, se busca otro bus de A
              // que llegue más tarde pero justo a tiempo para ese mismo bus de B.
              let useA = rideA;
              let wait = rideB.dep - ready;
              if (wait > o.maxTransferWaitMinutes) {
                const tarde = lastRideBefore(
                  va.lineIdx,
                  va.index,
                  k,
                  minBoard,
                  rideB.dep - walkMin - o.minTransferMinutes,
                );
                if (!tarde) continue;
                useA = tarde;
                wait = rideB.dep - (tarde.arr + walkMin);
                if (wait > o.maxTransferWaitMinutes) continue;
              }

              const arrivalMinutes = rideB.arr + dst.walk.minutes;
              const walkMeters = org.walk.meters + (t.walk ? t.walk.meters : 0) + dst.walk.meters;
              if (!improves(key, arrivalMinutes, walkMeters)) continue;
              const legA = makeLeg(va.lineIdx, va.index, k, useA);
              const legB = makeLeg(vb.lineIdx, vb.index, jd, rideB);
              best.set(key, {
                id: `${legId(legA)}|${legId(legB)}`,
                legs: [legA, legB],
                walkToStop: org.walk,
                transferWalk: t.walk,
                walkFromStop: dst.walk,
                firstWaitMinutes: useA.dep - minBoard,
                transferWaitMinutes: wait,
                arrivalMinutes,
                totalMinutes: arrivalMinutes - nowMinutes,
                walkMeters,
              });
            }
          }
        }
      }
    }
  }

  // Orden por llegada y recorte a maxResults, pero siempre se conserva el mejor viaje directo
  // (si lo hay): si se quedara fuera, ocupa el sitio de la opción con transbordo que llega más tarde.
  const ordenadas = [...best.values()].sort(
    (a, b) => a.arrivalMinutes - b.arrivalMinutes || a.walkMeters - b.walkMeters,
  );
  const elegidas = ordenadas.slice(0, o.maxResults);
  const directo = ordenadas.find((op) => op.legs.length === 1);
  if (directo && o.maxResults > 0 && !elegidas.includes(directo)) {
    elegidas[elegidas.length - 1] = directo;
  }
  return elegidas;
}

/** Copia de las opciones ordenada según el modo elegido (la lista original no cambia). */
export function sortOptions(options: RouteOption[], mode: SortMode): RouteOption[] {
  const copia = [...options];
  switch (mode) {
    case 'fastest':
      return copia.sort((a, b) => a.arrivalMinutes - b.arrivalMinutes || a.walkMeters - b.walkMeters);
    case 'leastWalking':
      return copia.sort((a, b) => a.walkMeters - b.walkMeters || a.arrivalMinutes - b.arrivalMinutes);
    case 'fewestTransfers':
      return copia.sort(
        (a, b) => a.legs.length - b.legs.length || a.arrivalMinutes - b.arrivalMinutes,
      );
  }
}

/** Coordenadas [lon, lat] de las paradas de un tramo, de la subida a la bajada (ambas incluidas). */
export function legCoords(leg: BusLeg, data: Dataset): [number, number][] {
  return leg.line.stopCodes
    .slice(leg.fromIndex, leg.toIndex + 1)
    .flatMap((code) => {
      const stop = data.stops[code];
      return stop ? [[stop.lon, stop.lat] as [number, number]] : [];
    });
}
