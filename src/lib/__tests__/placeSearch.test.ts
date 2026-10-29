// Pruebas de la búsqueda de lugares con Photon, siempre con un fetch falso (nunca se llama a la red real).
import {
  buildSearchUrl,
  parsePhoton,
  searchPlaces,
  clearSearchCache,
  SearchError,
  APP_USER_AGENT,
} from '../placeSearch';

function feature(osmId: number, lon: number, lat: number, props: Record<string, unknown>) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { osm_type: 'N', osm_id: osmId, ...props },
  };
}

// 3 features: una fuera de Jerez (Madrid) y dos repetidas dentro de Jerez.
const SAMPLE = {
  features: [
    feature(1, -6.1, 36.69, { name: 'Luz Shopping', street: 'Avenida del Ejército', housenumber: '1' }),
    feature(2, -6.1001, 36.6901, { name: 'Luz Shopping', street: 'Avenida del Ejército', housenumber: '1' }),
    feature(3, -3.7, 40.4, { name: 'Luz Shopping', street: 'Calle Mayor' }),
  ],
};

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

beforeEach(() => clearSearchCache());

describe('buildSearchUrl', () => {
  it('lleva q, limit=8 y bbox de Jerez', () => {
    const url = buildSearchUrl('Luz Shopping');
    expect(url).toContain('https://photon.komoot.io/api/?');
    expect(url).toContain('q=Luz%20Shopping');
    expect(url).toContain('limit=8');
    expect(url).toContain('bbox=-6.35,36.55,-5.85,36.85');
  });
});

describe('parsePhoton', () => {
  it('descarta lo de fuera de Jerez y quita repetidos', () => {
    const places = parsePhoton(SAMPLE);
    expect(places).toHaveLength(1);
    expect(places[0]).toEqual({
      id: 'N1',
      name: 'Luz Shopping',
      detail: 'Avenida del Ejército 1',
      lat: 36.69,
      lon: -6.1,
    });
  });

  it('descarta las que no tienen nombre ni calle y tolera basura', () => {
    expect(parsePhoton({ features: [feature(9, -6.1, 36.69, {})] })).toEqual([]);
    expect(parsePhoton(null)).toEqual([]);
    expect(parsePhoton({})).toEqual([]);
  });
});

describe('searchPlaces', () => {
  it('con menos de 3 caracteres no llama a fetch', async () => {
    const fetchFn = jest.fn();
    expect(await searchPlaces('ab', fetchFn as unknown as typeof fetch)).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('usa la caché y manda el User-Agent', async () => {
    const fetchFn = jest.fn(async () => okResponse(SAMPLE));
    const f = fetchFn as unknown as typeof fetch;
    await searchPlaces('Luz Shopping', f);
    const again = await searchPlaces('luz shopping ', f);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(again).toHaveLength(1);
    const init = (fetchFn.mock.calls[0] as unknown[])[1] as { headers: Record<string, string> };
    expect(init.headers['User-Agent']).toBe(APP_USER_AGENT);
  });

  it('error de red -> offline', async () => {
    const f = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(searchPlaces('Luz Shopping', f)).rejects.toMatchObject({ kind: 'offline' });
    await expect(searchPlaces('Luz Shopping', f)).rejects.toBeInstanceOf(SearchError);
  });

  it('429 -> busy y 500 -> failed', async () => {
    const f429 = jest.fn(async () => ({ ok: false, status: 429 }) as Response) as unknown as typeof fetch;
    const f500 = jest.fn(async () => ({ ok: false, status: 500 }) as Response) as unknown as typeof fetch;
    await expect(searchPlaces('Luz Shopping', f429)).rejects.toMatchObject({ kind: 'busy' });
    await expect(searchPlaces('Luz Shopping', f500)).rejects.toMatchObject({ kind: 'failed' });
  });

  it('JSON roto -> failed', async () => {
    const f = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('bad');
      },
    }) as unknown as Response) as unknown as typeof fetch;
    await expect(searchPlaces('Luz Shopping', f)).rejects.toMatchObject({ kind: 'failed' });
  });
});
