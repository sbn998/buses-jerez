// Prueba de humo del OCR: genera una imagen con el texto "21:38a" y comprueba que se lee.
// Es lenta (descarga el idioma la primera vez), así que solo corre con OCR_SMOKE=1.
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MAX_OCR_PIXELS, ocrImage, ocrScale } from '../src/pdf/ocr';

describe.skipIf(!process.env.OCR_SMOKE)('ocrImage', () => {
  it('reads a marked time', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100">' +
      '<rect width="300" height="100" fill="white"/>' +
      '<text x="20" y="70" font-family="Arial" font-size="56" fill="black">21:38a</text></svg>';
    const jpeg = await sharp(Buffer.from(svg)).jpeg().toBuffer();
    const page = await ocrImage(jpeg);
    expect(page.width).toBe(900);
    expect(page.words.some((w) => w.text.includes('21:38'))).toBe(true);
  }, 120_000);
});

// Prueba rápida (siempre se ejecuta): la ampliación nunca pasa de 40 megapíxeles.
describe('ocrScale', () => {
  it('uses x3 for small images and less for huge ones', () => {
    expect(ocrScale(4811, 712)).toBe(3);
    expect(ocrScale(5125, 3465)).toBeCloseTo(1.5, 1);
    expect(ocrScale(5125, 3465) ** 2 * 5125 * 3465).toBeLessThanOrEqual(MAX_OCR_PIXELS + 1);
  });
});
