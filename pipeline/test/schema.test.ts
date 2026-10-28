// Comprueba que el proceso de datos puede usar el "contrato" de datos que comparte con la app.
import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../../src/data/schema';

describe('schema', () => {
  it('exposes schema version 1', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});
