// Pruebas de formatMinutes: "ahora" cuando faltan 0 minutos, "en N min" en otro caso.
import { initI18n } from '@/i18n';
import i18n from 'i18next';

import { formatMinutes } from '../format';

beforeAll(() => {
  initI18n('es');
});

describe('formatMinutes', () => {
  it('0 minutos -> ahora', () => {
    expect(formatMinutes(0, i18n.t)).toBe('ahora');
  });
  it('9 minutos -> en 9 min', () => {
    expect(formatMinutes(9, i18n.t)).toBe('en 9 min');
  });
});
