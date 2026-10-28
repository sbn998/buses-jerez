/**
 * Contrato de datos de Buses Jerez.
 *
 * Este archivo describe la "forma" exacta de los datos que publica el proceso
 * diario (pipeline/) y que descarga la app. Lo usan los dos lados, así que si
 * cambia algo aquí, cambia para ambos a la vez y TypeScript avisa de lo que se
 * haya quedado desfasado.
 */

/** Tipo de día según Comujesa: laborable, sábado, o domingo/festivo. */
export type DayType = 'lab' | 'sab' | 'fes';

/** Una hora del día como texto, siempre con dos cifras: "07:28". */
export type TimeOfDay = string;

/** Todas las horas a las que pasa una línea por una parada, por tipo de día. */
export interface StopTimes {
  lab: TimeOfDay[];
  sab: TimeOfDay[];
  fes: TimeOfDay[];
}

/** Una parada física, identificada por el código que usa Comujesa (ej. "343"). */
export interface Stop {
  code: string;
  name: string;
  description: string;
  lat: number;
  lon: number;
  /** De dónde salen las coordenadas: mapa oficial, nombre parecido, OpenStreetMap o corrección manual. */
  coordSource: 'kml' | 'name-match' | 'osm' | 'override';
}

/** Un sentido de la línea ("hacia San Telmo") con sus paradas en orden. */
export interface Direction {
  headsign: string;
  stopCodes: string[];
}

export interface Line {
  /** "1" a "18". */
  id: string;
  /** Extremos de la línea, ej. "Esteve - San Telmo". */
  name: string;
  /** Color oficial de la línea, ej. "#FFDE4D". */
  colour: string;
  /** Recorrido completo, en el orden en que el bus pasa por las paradas. */
  stopCodes: string[];
  directions: Direction[];
  /** Dibujo del recorrido para el mapa: listas de puntos [lon, lat]. */
  shapes: [number, number][][];
  /** Horas de paso tal como las da Comujesa, por código de parada. */
  timesByStop: Record<string, StopTimes>;
  /**
   * Viajes reconstruidos: cada viaje es una fila con una hora (o null si ese
   * bus no pasa) por cada parada de `stopCodes`, en el mismo orden.
   */
  trips: Record<DayType, (TimeOfDay | null)[][]>;
}

export interface Holiday {
  /** Fecha "AAAA-MM-DD". */
  date: string;
  name: string;
  scope: 'national' | 'regional' | 'local';
}

/** Todo lo que descarga la app en un solo archivo (data.json). */
export interface Dataset {
  schemaVersion: 1;
  generatedAt: string;
  lines: Line[];
  stops: Record<string, Stop>;
  holidays: Holiday[];
}

/**
 * Archivo pequeño (manifest.json) que la app consulta primero para saber si
 * hay datos nuevos sin tener que descargar data.json entero.
 */
export interface Manifest {
  schemaVersion: 1;
  /** Huella del contenido: cambia solo si cambian los datos. */
  version: string;
  generatedAt: string;
  dataUrl: 'data.json';
}

export const SCHEMA_VERSION = 1 as const;
