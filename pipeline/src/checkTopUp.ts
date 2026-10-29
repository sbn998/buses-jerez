/**
 * Comprobación mensual del cartel de puntos de recarga.
 *
 * Comujesa publica los establecimientos de recarga como una imagen en su web. Si sube
 * un cartel nuevo, la lista de `topup-points.json` se queda anticuada. Este programa
 * descarga la página y, si la imagen del cartel ya no es la que tenemos apuntada,
 * imprime "changed". Si todo sigue igual (o la página no se puede leer), no imprime nada.
 *
 * Se ejecuta una vez al mes en GitHub (`.github/workflows/holidays.yml`), que abre una
 * "Issue" (una tarea) si sale "changed".
 */
import { readFileSync } from 'node:fs';
import { createClient } from './http';
import { topUpPosterChanged, type TopUpFile } from './topup';

if (process.argv[1]?.endsWith('checkTopUp.ts')) {
  const file = JSON.parse(readFileSync(new URL('../topup-points.json', import.meta.url), 'utf8')) as TopUpFile;
  try {
    const html = await createClient().getText(file.source);
    if (topUpPosterChanged(html, file.posterImage)) console.log('changed');
  } catch (err) {
    // Una web caída no es motivo de aviso: ya se volverá a comprobar el mes que viene.
    console.error(`No se pudo comprobar el cartel: ${String(err)}`);
  }
}
