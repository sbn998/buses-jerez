/**
 * Saca la imagen JPEG que viene dentro de un PDF de horarios.
 * Cada PDF de Comujesa es una sola imagen JPEG metida en un "stream", así que basta
 * con copiar sus bytes: no hace falta ninguna librería de PDF.
 */

/** Devuelve los bytes del stream JPEG (empieza por FF D8) más grande: si hubiera una miniatura, se ignora. */
export function extractJpeg(pdf: Uint8Array): Uint8Array {
  const buf = Buffer.from(pdf.buffer, pdf.byteOffset, pdf.byteLength);
  let best: Uint8Array | null = null;
  let from = 0;
  for (;;) {
    const word = buf.indexOf('stream', from, 'latin1');
    if (word < 0) break;
    // Saltamos "endstream": lo que buscamos es el "stream" que abre los datos.
    if (word >= 3 && buf.toString('latin1', word - 3, word) === 'end') {
      from = word + 6;
      continue;
    }
    // Tras "stream" va un salto de línea (CRLF o LF) y después los datos.
    let start = word + 6;
    if (buf[start] === 0x0d) start++;
    if (buf[start] === 0x0a) start++;
    if (buf[start] === 0xff && buf[start + 1] === 0xd8) {
      const end = buf.indexOf('endstream', start, 'latin1');
      if (end < 0) break;
      // Cortamos en el último FF D9 antes de "endstream".
      const eoi = buf.lastIndexOf(Buffer.from([0xff, 0xd9]), end);
      if (eoi >= start && (!best || eoi + 2 - start > best.length)) {
        best = new Uint8Array(buf.subarray(start, eoi + 2));
      }
      from = end + 9;
      continue;
    }
    from = start;
  }
  if (!best) throw new Error('PDF sin imagen JPEG');
  return best;
}
