// Pruebas del mapa sin conexión: descarga completa, descarga a medias y borrado (con disco falso).
import {
  FONT_FILES,
  deleteOfflineMap,
  downloadOfflineMap,
  getOfflineStatus,
  readLocalStyle,
  setOfflineFs,
  useOfflineMap,
} from '../offlineMap';
import { FAKE_BASE, createFakeFs } from '../testing/fakeOfflineFs';

afterEach(() => {
  setOfflineFs(null);
  useOfflineMap.setState({ status: { downloaded: false, bytes: 0 } });
});

describe('offlineMap', () => {
  it('sin nada descargado, el estado es no descargado', async () => {
    setOfflineFs(createFakeFs().fs);
    expect(await getOfflineStatus()).toEqual({ downloaded: false, bytes: 0 });
  });

  it('una descarga completa da downloaded true, los bytes correctos y el progreso', async () => {
    const { fs, files, urls } = createFakeFs();
    setOfflineFs(fs);
    const progress: [number, number][] = [];
    await downloadOfflineMap((done, total) => progress.push([done, total]));

    const status = await getOfflineStatus();
    expect(status.downloaded).toBe(true);
    const manifest = JSON.parse(files.get('map/manifest.json')!);
    expect(manifest.files).toHaveLength(2 + FONT_FILES.length);
    expect(status.bytes).toBe(manifest.files.reduce((s: number, f: { bytes: number }) => s + f.bytes, 0));
    expect(useOfflineMap.getState().status).toEqual(status);
    expect(progress[0]).toEqual([0, 8]);
    expect(progress[progress.length - 1]).toEqual([8, 8]);
    expect(files.has('map-tmp/style.json')).toBe(false);
    // El nombre de la tipografía va codificado en la dirección web.
    expect(urls).toContain('https://sbn998.github.io/buses-jerez/map/fonts/Noto%20Sans%20Bold/8192-8447.pbf');
    // El estilo guardado ya apunta al disco del móvil.
    const style = (await readLocalStyle()) as { glyphs: string };
    expect(style.glyphs).toBe(`${FAKE_BASE}/map/fonts/{fontstack}/{range}.pbf`);
  });

  it('partial download is cleaned: si falla la tercera descarga se borra la carpeta temporal', async () => {
    const { fs, files } = createFakeFs({ failOnDownload: 3 });
    setOfflineFs(fs);
    await expect(downloadOfflineMap(() => {})).rejects.toThrow('sin red');
    expect([...files.keys()].filter((k) => k.startsWith('map-tmp/'))).toEqual([]);
    expect(files.has('map/manifest.json')).toBe(false);
    expect(await getOfflineStatus()).toEqual({ downloaded: false, bytes: 0 });
    expect(useOfflineMap.getState().status.downloaded).toBe(false);
  });

  it('un fallo al descargar no estropea un mapa ya descargado', async () => {
    const first = createFakeFs();
    setOfflineFs(first.fs);
    await downloadOfflineMap(() => {});
    // Segunda descarga que falla, sobre el mismo disco.
    const failing = createFakeFs({ failOnDownload: 4 });
    first.files.forEach((v, k) => failing.files.set(k, v));
    setOfflineFs(failing.fs);
    await expect(downloadOfflineMap(() => {})).rejects.toThrow();
    expect((await getOfflineStatus()).downloaded).toBe(true);
  });

  it('un archivo con tamaño distinto al del manifiesto cuenta como no descargado', async () => {
    const { fs, files } = createFakeFs();
    setOfflineFs(fs);
    await downloadOfflineMap(() => {});
    files.set('map/jerez.pmtiles', 'corto');
    expect((await getOfflineStatus()).downloaded).toBe(false);
  });

  it('un archivo que falta cuenta como no descargado', async () => {
    const { fs, files } = createFakeFs();
    setOfflineFs(fs);
    await downloadOfflineMap(() => {});
    files.delete('map/fonts/Noto Sans Bold/0-255.pbf');
    expect((await getOfflineStatus()).downloaded).toBe(false);
  });

  it('borrar deja el mapa como no descargado', async () => {
    setOfflineFs(createFakeFs().fs);
    await downloadOfflineMap(() => {});
    await deleteOfflineMap();
    expect(useOfflineMap.getState().status.downloaded).toBe(false);
    expect(await readLocalStyle()).toBeNull();
  });
});
