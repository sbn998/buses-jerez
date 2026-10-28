// Pruebas de la sincronización de datos, con dependencias falsas (sin red ni disco reales).
import type { Dataset, Manifest } from '@/data/schema';
import { parseStored, pickDataset, syncData, type Stored, type SyncDeps } from '../dataSync';

function makeDataset(over: Partial<Dataset> = {}): Dataset {
  return { schemaVersion: 1, generatedAt: '2026-01-01T00:00:00.000Z', lines: [], stops: {}, holidays: [], ...over };
}
function makeManifest(version: string): Manifest {
  return { schemaVersion: 1, version, generatedAt: '2026-01-01T00:00:00.000Z', dataUrl: 'data.json' };
}

const NOW = new Date('2026-05-05T10:00:00.000Z');
const current: Stored = { version: 'v1', checkedAt: '2026-01-02T00:00:00.000Z', data: makeDataset() };

function makeDeps(fetchText: SyncDeps['fetchText']): SyncDeps & { writeStored: jest.Mock; fetchText: jest.Mock } {
  return {
    fetchText: jest.fn(fetchText),
    readStored: jest.fn(async () => null),
    writeStored: jest.fn(async () => {}),
    now: () => NOW,
  };
}

describe('dataSync', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('falls back to bundled when offline', async () => {
    const deps = makeDeps(async () => {
      throw new Error('sin red');
    });
    expect(await syncData(deps, null)).toBeNull();
    expect(deps.writeStored).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    const bundled = makeDataset();
    expect(pickDataset(null, bundled)).toEqual({ data: bundled, source: 'bundled', checkedAt: null });
  });

  it('uses downloaded data when stored is valid', () => {
    const picked = pickDataset(current, makeDataset({ generatedAt: 'otro' }));
    expect(picked.source).toBe('downloaded');
    expect(picked.checkedAt).toBe(current.checkedAt);
    expect(picked.data).toBe(current.data);
  });

  it('ignores corrupt or future cache', () => {
    expect(parseStored('{"version":')).toBeNull();
    expect(parseStored(null)).toBeNull();
    const future = { ...current, data: { ...current.data, schemaVersion: 2 } };
    expect(parseStored(JSON.stringify(future))).toBeNull();
    expect(parseStored(JSON.stringify(current))).toEqual(current);
  });

  it('same version only updates checkedAt', async () => {
    const deps = makeDeps(async () => JSON.stringify(makeManifest('v1')));
    const result = await syncData(deps, current);
    expect(deps.fetchText).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ...current, checkedAt: NOW.toISOString() });
    expect(deps.writeStored).toHaveBeenCalledTimes(1);
    expect(JSON.parse(deps.writeStored.mock.calls[0][0])).toEqual({ ...current, checkedAt: NOW.toISOString() });
  });

  it('new version downloads data', async () => {
    const newData = makeDataset({ generatedAt: '2026-05-05T00:00:00.000Z' });
    const deps = makeDeps(async (url) =>
      url.endsWith('manifest.json') ? JSON.stringify(makeManifest('v2')) : JSON.stringify(newData),
    );
    const result = await syncData(deps, current);
    expect(deps.fetchText).toHaveBeenCalledTimes(2);
    expect(deps.fetchText).toHaveBeenLastCalledWith('https://sbn998.github.io/buses-jerez/data.json');
    expect(result).toEqual({ version: 'v2', checkedAt: NOW.toISOString(), data: newData });
    expect(deps.writeStored).toHaveBeenCalledTimes(1);
  });

  it('rejects downloaded data with other schema', async () => {
    const deps = makeDeps(async (url) =>
      url.endsWith('manifest.json')
        ? JSON.stringify(makeManifest('v2'))
        : JSON.stringify({ ...makeDataset(), schemaVersion: 2 }),
    );
    expect(await syncData(deps, current)).toBe(current);
    expect(deps.writeStored).not.toHaveBeenCalled();
  });

  it('returns current when writeStored rejects', async () => {
    const deps = makeDeps(async () => JSON.stringify(makeManifest('v1')));
    deps.writeStored.mockRejectedValue(new Error('disco lleno'));
    expect(await syncData(deps, current)).toBe(current);
  });

  it('returns current on bad JSON in the manifest', async () => {
    const deps = makeDeps(async () => '{"version":');
    expect(await syncData(deps, current)).toBe(current);
    expect(deps.writeStored).not.toHaveBeenCalled();
  });

  it('returns current on bad JSON in data.json', async () => {
    const deps = makeDeps(async (url) => (url.endsWith('manifest.json') ? JSON.stringify(makeManifest('v2')) : '{"lines":'));
    expect(await syncData(deps, current)).toBe(current);
    expect(deps.writeStored).not.toHaveBeenCalled();
  });

  it('rejects a manifest with another schema', async () => {
    const deps = makeDeps(async () => JSON.stringify({ ...makeManifest('v2'), schemaVersion: 2 }));
    expect(await syncData(deps, current)).toBe(current);
    expect(deps.fetchText).toHaveBeenCalledTimes(1);
    expect(deps.writeStored).not.toHaveBeenCalled();
  });

  it('rejects data with schemaVersion 1 but without lines', async () => {
    const { lines: _lines, ...noLines } = makeDataset();
    expect(parseStored(JSON.stringify({ ...current, data: noLines }))).toBeNull();
    const deps = makeDeps(async (url) =>
      url.endsWith('manifest.json') ? JSON.stringify(makeManifest('v2')) : JSON.stringify(noLines),
    );
    expect(await syncData(deps, current)).toBe(current);
    expect(deps.writeStored).not.toHaveBeenCalled();
  });
});
