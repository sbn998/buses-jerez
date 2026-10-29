// Prueba de writeStyle: escribe style.json en la carpeta que se le indique.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeStyle } from '../src/map/writeStyle';

let dir = '';
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('writeStyle', () => {
  it('writes a valid style.json (version 8) inside map/ of the given folder', () => {
    dir = mkdtempSync(join(tmpdir(), 'writestyle-'));
    writeStyle(dir);
    const style = JSON.parse(readFileSync(join(dir, 'map', 'style.json'), 'utf8'));
    expect(style.version).toBe(8);
    expect(style.sources.openmaptiles.url).toBe(
      'pmtiles://https://sbn998.github.io/buses-jerez/map/jerez.pmtiles',
    );
  });
});
