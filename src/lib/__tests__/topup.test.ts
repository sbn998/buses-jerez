// Pruebas de groupTopUp (src/lib/topup.ts): orden de las zonas y zonas vacías.
import type { TopUpPoint } from '@/data/schema';
import { groupTopUp } from '@/lib/topup';

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
