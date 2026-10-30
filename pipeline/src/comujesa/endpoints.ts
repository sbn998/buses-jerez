/**
 * Direcciones de la web de Comujesa (y de sus mapas en Google) que usa el proceso.
 * Están todas aquí para que, si Comujesa cambia algo, solo haya que tocar un sitio.
 */

export const BASE = 'https://www.comujesa.es';

/** Lista de paradas de una línea. Se llama con el formulario `valorLinea=<línea>`. */
export const STOPS_URL = BASE + '/autobuses-urbanos/paradas-y-horarios/listar-c-consultas';

/** Horas de paso de una parada. Formulario `valorCaja1=<código parada>&valorLinea=<línea>`. */
export const TIMES_URL = BASE + '/autobuses-urbanos/paradas-y-horarios/listar-b';

/** Página de una línea, con sus paradas por sentido y el mapa incrustado. */
export const linePageUrl = (id: string) =>
  BASE + '/autobuses-urbanos/lineas-paradas-y-horarios/linea-' + id;

/** Página «Información útil» de Comujesa, donde están enlazados los PDF de horarios. */
export const INFO_URL = BASE + '/autobuses-urbanos/inf-util';

/** Descarga del mapa oficial de una línea (Google My Maps) en formato KML. */
export const kmlUrl = (mid: string) =>
  'https://www.google.com/maps/d/kml?mid=' + mid + '&forcekml=1';
