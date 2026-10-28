/**
 * Lee la página web de una línea de Comujesa para sacar dos cosas:
 *
 * 1. El identificador de su mapa oficial de Google (`mapId`), que está en el
 *    <iframe> incrustado. Con él se descarga el mapa en KML (ver parseKml).
 * 2. Los sentidos de la línea ("Sentido » San Telmo") con los nombres de sus
 *    paradas en orden. Cada sentido es un botón de un acordeón que abre una
 *    lista <ul class="list-normal">.
 */
import * as cheerio from 'cheerio';

export interface LinePage {
  mapId: string | null;
  directions: { headsign: string; stopNames: string[] }[];
}

const MAP_ID = /maps\/d\/(?:u\/\d+\/)?embed\?mid=([\w-]+)/;

/** Quita los espacios raros (&nbsp;) y los espacios repetidos. */
const clean = (s: string) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

export function parseLinePage(html: string): LinePage {
  const $ = cheerio.load(html);
  const directions: LinePage['directions'] = [];
  $('button[aria-controls]').each((_, el) => {
    const match = clean($(el).text()).match(/^Sentido\s*»\s*(.+)$/);
    if (!match) return;
    // El botón apunta (aria-controls) al bloque que contiene la lista de paradas.
    const panel = $('#' + $(el).attr('aria-controls'));
    const stopNames = panel
      .find('ul.list-normal')
      .first()
      .find('li')
      .map((_, li) => clean($(li).text()))
      .get()
      .filter(Boolean);
    directions.push({ headsign: match[1], stopNames });
  });
  return { mapId: html.match(MAP_ID)?.[1] ?? null, directions };
}
