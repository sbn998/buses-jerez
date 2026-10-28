// Ayuda para los colores de las líneas: elige texto negro o blanco según el fondo,
// para que el número de la línea siempre se lea bien sobre su color.

/** Devuelve '#000000' o '#FFFFFF' según la luminosidad del color de fondo ("#RRGGBB"). */
export function textColourFor(background: string): '#000000' | '#FFFFFF' {
  const hex = background.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Fórmula habitual de brillo percibido (el ojo ve más el verde que el azul).
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150 ? '#000000' : '#FFFFFF';
}
