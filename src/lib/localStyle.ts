// Convierte el estilo remoto del mapa en uno que lee todo del móvil (teselas y tipografías descargadas).
// Es una función pura: no toca el estilo original, devuelve una copia cambiada.

/**
 * Devuelve una copia del estilo con las dos direcciones apuntando a la carpeta local `dirUri`:
 * las teselas (`jerez.pmtiles`) y las tipografías (`fonts/...`). Lanza un error si el estilo no trae
 * la fuente `openmaptiles`, para no guardar un mapa sin conexión que luego no pinte nada.
 */
export function buildLocalStyle(remote: object, dirUri: string): object {
  const base = dirUri.replace(/\/+$/, '');
  // Copia profunda: así nunca modificamos el objeto original.
  const style = JSON.parse(JSON.stringify(remote)) as {
    sources?: Record<string, { url?: string }>;
    glyphs?: string;
  };
  const source = style.sources?.openmaptiles;
  if (!source) throw new Error('El estilo no tiene la fuente openmaptiles');
  source.url = `pmtiles://${base}/jerez.pmtiles`;
  style.glyphs = `${base}/fonts/{fontstack}/{range}.pbf`;
  return style;
}
