// Pruebas de groupTopUp (src/lib/topup.ts): orden de las zonas y zonas vacías.
import type { TopUpPoint } from '@/data/schema';
import { formatCheckedDate, groupTopUp, topUpFor } from '@/lib/topup';

const punto = (name: string, zone: TopUpPoint['zone']): TopUpPoint => ({ name, address: 'Calle 1', zone });

describe('groupTopUp', () => {
  it('pone las oficinas primero y luego centro, norte, este, oeste y sur', () => {
    const grupos = groupTopUp([
      punto('S', 'sur'),
      punto('O', 'oeste'),
      punto('E', 'este'),
      punto('N', 'norte'),
      punto('C', 'centro'),
      punto('Of', 'oficina'),
    ]);
    expect(grupos.map((g) => g.zone)).toEqual(['oficina', 'centro', 'norte', 'este', 'oeste', 'sur']);
  });

  it('quita las zonas vacías y conserva el orden de los puntos dentro de cada zona', () => {
    const grupos = groupTopUp([punto('B', 'este'), punto('A', 'oficina'), punto('C', 'este')]);
    expect(grupos.map((g) => g.zone)).toEqual(['oficina', 'este']);
    expect(grupos[1].points.map((p) => p.name)).toEqual(['B', 'C']);
  });

  it('sin puntos devuelve una lista vacía', () => {
    expect(groupTopUp([])).toEqual([]);
  });
});

describe('topUpFor', () => {
  const bundled = { topUpPoints: [punto('B', 'sur')], topUpChecked: '2026-10-01' };

  it('usa los datos descargados si traen puntos', () => {
    const data = { topUpPoints: [punto('D', 'centro')], topUpChecked: '2026-10-29' };
    expect(topUpFor(data, bundled)).toEqual({ points: data.topUpPoints, checked: '2026-10-29' });
  });

  it('si los descargados no traen puntos (copia antigua), usa los de la copia incluida con su fecha', () => {
    expect(topUpFor({}, bundled)).toEqual({ points: bundled.topUpPoints, checked: '2026-10-01' });
  });
});

describe('formatCheckedDate', () => {
  it('formatea una fecha real y devuelve null si no se puede leer', () => {
    expect(formatCheckedDate('2026-10-29', 'es')).toBe('29/10/2026');
    expect(formatCheckedDate('ayer', 'es')).toBeNull();
    expect(formatCheckedDate('2026-02-30', 'es')).toBeNull();
    expect(formatCheckedDate(undefined, 'es')).toBeNull();
  });
});
