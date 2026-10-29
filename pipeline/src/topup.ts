/**
 * Puntos de recarga de la tarjeta (Multiviaje, Azul o Mensual).
 *
 * Comujesa publica los establecimientos solo como un cartel (una imagen), así que
 * la lista se copia a mano en `topup-points.json`. Este archivo:
 *  - lee esa lista para meterla en los datos de la app (`loadTopUp`);
 *  - detecta si Comujesa ha subido un cartel distinto (`topUpPosterChanged`), para
 *    avisarte de que hay que volver a copiarlo. Lo usa la comprobación mensual.
 */
import type { TopUpPoint } from '../../src/data/schema';

/** Forma del archivo `topup-points.json`. */
export interface TopUpFile {
  source: string;
  posterImage: string;
  checked: string;
  points: TopUpPoint[];
}

/** Saca la lista de puntos del contenido del archivo. */
export function loadTopUp(file: Pick<TopUpFile, 'points'>): TopUpPoint[] {
  return file.points.map((p) => ({ ...p }));
}

/** Ruta de la primera imagen de la página cuyo nombre contiene "RedVenta" (el cartel), o null. */
export function posterImageFromPage(html: string): string | null {
  for (const match of html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    if (match[1].includes('RedVenta')) return match[1];
  }
  return null;
}

/** ¿Es distinto el cartel de la página al que tenemos copiado? Si la página no trae cartel, no se avisa. */
export function topUpPosterChanged(html: string, recorded: string): boolean {
  const current = posterImageFromPage(html);
  return current !== null && current !== recorded;
}
