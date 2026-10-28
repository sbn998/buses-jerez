/**
 * Manifiesto: el archivo pequeño que la app consulta para saber si hay datos nuevos.
 *
 * La "versión" es una huella (sha256) del contenido de los datos, sin contar la fecha
 * en que se generaron. Así, si un día Comujesa no cambia nada, la versión es la
 * misma y la app no vuelve a descargar data.json.
 */
import { createHash } from 'node:crypto';
import { SCHEMA_VERSION, type Dataset, type Manifest } from '../../src/data/schema';

export function makeManifest(ds: Dataset): Manifest {
  const { generatedAt, ...content } = ds;
  const version = createHash('sha256').update(JSON.stringify(content)).digest('hex');
  return { schemaVersion: SCHEMA_VERSION, version, generatedAt, dataUrl: 'data.json' };
}
