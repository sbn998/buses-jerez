/**
 * Lee la lista de paradas de una línea que devuelve el buscador de Comujesa.
 *
 * Comujesa responde con un desplegable HTML: <option value='343'>Plaza Esteve Esteve</option>.
 * El número es el código de la parada. El texto junta el nombre y una descripción
 * separados solo por un espacio, así que no se pueden separar y se guarda entero
 * como `label`. El nombre limpio sale después del mapa oficial (parseKml).
 */
import * as cheerio from 'cheerio';

export interface StopOption {
  code: string;
  label: string;
}

export function parseStopOptions(html: string): StopOption[] {
  const $ = cheerio.load(html);
  const stops: StopOption[] = [];
  $('option').each((_, el) => {
    const code = ($(el).attr('value') ?? '').trim();
    // La opción "0" es el texto "Seleccione parada", no una parada.
    if (!code || code === '0') return;
    stops.push({ code, label: $(el).text().replace(/\s+/g, ' ').trim() });
  });
  return stops;
}
