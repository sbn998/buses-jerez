// Pruebas de OfflineMapSection: los 4 estados (sin descargar, descargando, descargado y error).
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { initI18n } from '@/i18n';
import { setOfflineFs, useOfflineMap } from '@/lib/offlineMap';
import { createFakeFs } from '@/lib/testing/fakeOfflineFs';

import { OfflineMapSection } from '../OfflineMapSection';

beforeAll(() => {
  initI18n('es');
});

afterEach(() => {
  setOfflineFs(null);
  useOfflineMap.setState({ status: { downloaded: false, bytes: 0 }, downloading: null, error: false });
});

describe('OfflineMapSection', () => {
  it('sin descargar: ofrece descargar con el tamaño aproximado', async () => {
    setOfflineFs(createFakeFs().fs);
    await render(<OfflineMapSection />);
    expect(screen.getByText('Descargar mapa de Jerez (≈ 4 MB)')).toBeTruthy();
  });

  it('descargando: muestra el progreso y, al terminar, el mapa descargado con Borrar', async () => {
    const { fs, urls } = createFakeFs();
    // Frenamos la tercera descarga para ver el progreso intermedio.
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = fs.download;
    fs.download = async (url, path) => {
      if (urls.length === 2) await gate;
      await original(url, path);
    };
    setOfflineFs(fs);
    await render(<OfflineMapSection />);
    // Sin await: la descarga queda frenada y la pulsación no terminaría hasta soltarla.
    void fireEvent.press(screen.getByText('Descargar mapa de Jerez (≈ 4 MB)'));
    await waitFor(() => expect(screen.getByText('Descargando… 2 de 8')).toBeTruthy());
    await act(async () => release());
    await waitFor(() => expect(screen.getByText('Borrar')).toBeTruthy());
    expect(screen.getByText(/Mapa descargado · \d/)).toBeTruthy();
  });

  it('descargado: Borrar vuelve al estado de descargar', async () => {
    setOfflineFs(createFakeFs().fs);
    await render(<OfflineMapSection />);
    await fireEvent.press(screen.getByText('Descargar mapa de Jerez (≈ 4 MB)'));
    await waitFor(() => expect(screen.getByText('Borrar')).toBeTruthy());
    await fireEvent.press(screen.getByText('Borrar'));
    await waitFor(() => expect(screen.getByText('Descargar mapa de Jerez (≈ 4 MB)')).toBeTruthy());
  });

  it('si ya estaba descargado al abrir Opciones, lo muestra', async () => {
    const fake = createFakeFs();
    setOfflineFs(fake.fs);
    const { downloadOfflineMap } = require('@/lib/offlineMap');
    await downloadOfflineMap(() => {});
    useOfflineMap.setState({ status: { downloaded: false, bytes: 0 } });
    await render(<OfflineMapSection />);
    await waitFor(() => expect(screen.getByText('Borrar')).toBeTruthy());
  });

  it('error: muestra el aviso y Reintentar vuelve a intentarlo', async () => {
    const { fs } = createFakeFs({ failOnDownload: 1 });
    setOfflineFs(fs);
    await render(<OfflineMapSection />);
    await fireEvent.press(screen.getByText('Descargar mapa de Jerez (≈ 4 MB)'));
    await waitFor(() => expect(screen.getByText('No se pudo descargar.')).toBeTruthy());
    await fireEvent.press(screen.getByText('Reintentar'));
    // La segunda vez el disco falso ya no falla (solo falla la descarga número 1).
    await waitFor(() => expect(screen.getByText('Borrar')).toBeTruthy());
  });

  it('al salir de Opciones y volver con la descarga en marcha, sigue mostrando el progreso real', async () => {
    const { fs, urls } = createFakeFs();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = fs.download;
    fs.download = async (url, path) => {
      if (urls.length === 2) await gate;
      await original(url, path);
    };
    setOfflineFs(fs);
    const first = await render(<OfflineMapSection />);
    void fireEvent.press(screen.getByText('Descargar mapa de Jerez (≈ 4 MB)'));
    await waitFor(() => expect(screen.getByText('Descargando… 2 de 8')).toBeTruthy());
    await first.unmount();
    await render(<OfflineMapSection />);
    expect(screen.getByText('Descargando… 2 de 8')).toBeTruthy();
    expect(screen.queryByText('Descargar mapa de Jerez (≈ 4 MB)')).toBeNull();
    await act(async () => release());
    await waitFor(() => expect(screen.getByText('Borrar')).toBeTruthy());
    expect(urls).toHaveLength(8);
  });
});
