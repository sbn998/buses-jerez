/**
 * Cliente HTTP "educado" para hablar con la web de Comujesa.
 *
 * - Espera un poco entre peticiones (250 ms) para no saturar su servidor.
 * - Si una petición falla, la repite hasta 3 veces, esperando cada vez más.
 * - Se identifica con un User-Agent que dice quiénes somos y dónde está el proyecto.
 */

export const USER_AGENT = 'buses-jerez-data/1.0 (+https://github.com/sbn998/buses-jerez)';

export interface ClientOptions {
  delayMs?: number;
  retryDelaysMs?: number[];
  /** Permite usar un fetch falso en las pruebas. */
  fetchImpl?: typeof fetch;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createClient(opts: ClientOptions = {}) {
  const delayMs = opts.delayMs ?? 250;
  const retryDelaysMs = opts.retryDelaysMs ?? [2000, 4000, 8000];
  const fetchImpl = opts.fetchImpl ?? fetch;
  let lastRequestAt = 0;

  /** Hace la petición respetando la espera entre peticiones y los reintentos. */
  async function request(url: string, init: RequestInit): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
      if (attempt > 0) await sleep(retryDelaysMs[attempt - 1]);
      const wait = lastRequestAt + delayMs - Date.now();
      if (wait > 0) await sleep(wait);
      lastRequestAt = Date.now();
      try {
        const res = await fetchImpl(url, init);
        if (res.ok) return await res.text();
        lastError = new Error(`HTTP ${res.status}`);
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(`Fallo al descargar ${url}: ${String(lastError)}`);
  }

  return {
    getText(url: string) {
      return request(url, { headers: { 'user-agent': USER_AGENT } });
    },
    postForm(url: string, form: Record<string, string>) {
      return request(url, {
        method: 'POST',
        headers: {
          'user-agent': USER_AGENT,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(form).toString(),
      });
    },
  };
}

export type HttpClient = ReturnType<typeof createClient>;
