// Pruebas de la carga real de DataProvider (con expo-file-system y la red simuladas).
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';

import { DataProvider, useData } from '../DataProvider';
import bundledJson from '../bundled.json';
import type { Dataset } from '../schema';

// Disco simulado: `mockDisk.read` decide qué devuelve la lectura del archivo.
const mockDisk: { read: () => Promise<string> } = { read: async () => '' };
jest.mock('expo-file-system', () => ({
  Paths: { document: 'doc' },
  File: class {
    exists = true;
    text() {
      return mockDisk.read();
    }
    create() {}
    write() {}
  },
}));

function Probe() {
  const { data, source } = useData();
  return <Text>{`${data.generatedAt}|${source}`}</Text>;
}

const cached: Dataset = { schemaVersion: 1, generatedAt: 'cached-date', lines: [], stops: {}, holidays: [] };
const bundledLabel = `${(bundledJson as unknown as Dataset).generatedAt}|bundled`;

let warn: jest.SpyInstance;
let error: jest.SpyInstance;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
  // Sin red: la comprobación en segundo plano falla y deja lo que haya.
  global.fetch = jest.fn().mockRejectedValue(new Error('sin red')) as unknown as typeof fetch;
});
afterEach(() => {
  warn.mockRestore();
  error.mockRestore();
});

it('replaces bundled data with cached data from disk once loaded', async () => {
  mockDisk.read = async () => JSON.stringify({ version: 'v1', checkedAt: 'hoy', data: cached });
  await render(<DataProvider><Probe /></DataProvider>);
  await waitFor(() => expect(screen.getByText('cached-date|downloaded')).toBeTruthy());
});

it('keeps bundled data when reading the disk fails', async () => {
  mockDisk.read = async () => {
    throw new Error('disco roto');
  };
  await render(<DataProvider><Probe /></DataProvider>);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  expect(screen.getByText(bundledLabel)).toBeTruthy();
  expect(warn).toHaveBeenCalled();
});

it('does not update state after unmount', async () => {
  let release: (s: string) => void = () => {};
  mockDisk.read = () => new Promise<string>((r) => (release = r));
  const view = await render(<DataProvider><Probe /></DataProvider>);
  await view.unmount();
  release(JSON.stringify({ version: 'v1', checkedAt: 'hoy', data: cached }));
  await new Promise((r) => setTimeout(r, 20));
  expect(global.fetch).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});

// --- Volver a buscar datos nuevos al regresar a la app ---
const HOUR = 3_600_000;

// Monta el proveedor con datos guardados de hace `hoursAgo` horas, espera a que termine la
// comprobación del arranque y devuelve la función que simula el cambio de estado de la app.
async function mountWithCheckedAgo(hoursAgo: number) {
  let handler: (s: string) => void = () => {};
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
    handler = h;
    return { remove };
  }) as never);
  const checkedAt = new Date(Date.now() - hoursAgo * HOUR).toISOString();
  mockDisk.read = async () => JSON.stringify({ version: 'v1', checkedAt, data: cached });
  const view = await render(<DataProvider><Probe /></DataProvider>);
  await waitFor(() => expect(screen.getByText('cached-date|downloaded')).toBeTruthy());
  // La comprobación del arranque falla (sin red): esperamos a que termine y la olvidamos.
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 20));
  (global.fetch as jest.Mock).mockClear();
  return { fire: (s: string) => handler(s), remove, view };
}

describe('al volver a la app', () => {
  afterEach(() => jest.restoreAllMocks());

  it('busca datos nuevos si la última comprobación fue hace más de 12 h', async () => {
    const { fire } = await mountWithCheckedAgo(13);
    await act(async () => fire('active'));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('manifest.json');
  });

  it('no busca si la última comprobación fue hace menos de 12 h', async () => {
    const { fire } = await mountWithCheckedAgo(1);
    await act(async () => fire('active'));
    await new Promise((r) => setTimeout(r, 20));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('ignora los estados que no son active', async () => {
    const { fire } = await mountWithCheckedAgo(13);
    await act(async () => fire('background'));
    await new Promise((r) => setTimeout(r, 20));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('dos eventos seguidos con una sincronización en curso lanzan una sola descarga', async () => {
    const { fire } = await mountWithCheckedAgo(13);
    // La descarga se queda esperando para que la primera siga "en curso".
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    await act(async () => {
      fire('active');
      fire('active');
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('cancela la suscripción al desmontar', async () => {
    const { remove, view } = await mountWithCheckedAgo(13);
    await view.unmount();
    expect(remove).toHaveBeenCalled();
  });
});
