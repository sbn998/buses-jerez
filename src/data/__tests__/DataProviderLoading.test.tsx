// Pruebas de la carga real de DataProvider (con expo-file-system y la red simuladas).
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

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
