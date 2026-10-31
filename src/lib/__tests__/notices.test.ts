// Pruebas de los avisos al abrir la app: caducado, cambio próximo y avisos a mano.
import type { Dataset } from '@/data/schema';
import i18n, { initI18n } from '@/i18n';

import { activeNotices } from '../notices';

beforeAll(() => {
  initI18n('es');
});

const base: Dataset = { schemaVersion: 1, generatedAt: '', lines: [], stops: {}, holidays: [] };
const withPeriod: Dataset = {
  ...base,
  period: { name: 'Invierno', validFrom: '2026-09-01', validTo: '2027-06-27' },
};

describe('activeNotices', () => {
  it('avisa del cambio en los 5 últimos días con la fecha del día siguiente', () => {
    expect(activeNotices(withPeriod, '2027-06-23', 'es', i18n.t)).toEqual([
      {
        id: 'period-change-2027-06-27',
        text: 'El 28 de junio empieza un horario nuevo. Revisa tus horas habituales.',
      },
    ]);
    expect(activeNotices(withPeriod, '2027-06-27', 'es', i18n.t)).toHaveLength(1);
    expect(activeNotices(withPeriod, '2027-06-22', 'es', i18n.t)).toEqual([]);
  });

  it('warns when period expired', () => {
    expect(activeNotices(withPeriod, '2027-06-28', 'es', i18n.t)).toEqual([
      {
        id: 'period-expired-2027-06-27',
        text: 'Los horarios publicados eran válidos hasta el 27 de junio. Puede que no estén al día.',
      },
    ]);
  });

  it('escribe la fecha en inglés', () => {
    const t = i18n.getFixedT('en');
    expect(activeNotices(withPeriod, '2027-06-23', 'en', t)[0].text).toBe(
      'A new timetable starts on June 28. Check your usual times.',
    );
  });

  it('un aviso a mano sale solo entre from y to', () => {
    const ds: Dataset = {
      ...base,
      notices: [{ id: 'feria', from: '2027-05-01', to: '2027-05-08', es: 'Feria', en: 'Fair' }],
    };
    expect(activeNotices(ds, '2027-04-30', 'es', i18n.t)).toEqual([]);
    expect(activeNotices(ds, '2027-05-01', 'es', i18n.t)).toEqual([{ id: 'feria', text: 'Feria' }]);
    expect(activeNotices(ds, '2027-05-08', 'en', i18n.t)).toEqual([{ id: 'feria', text: 'Fair' }]);
    expect(activeNotices(ds, '2027-05-09', 'es', i18n.t)).toEqual([]);
  });

  it('shows nothing without period or notices', () => {
    expect(activeNotices(base, '2027-06-28', 'es', i18n.t)).toEqual([]);
  });
});
