// Prueba del selector de parada: el título "Hacia …" solo sale si la línea tiene dos sentidos.
import { render, screen } from '@testing-library/react-native';

import type { Line, Stop } from '@/data/schema';
import { initI18n } from '@/i18n';

import { StopPicker } from '../StopPicker';

const stops: Record<string, Stop> = {
  A: { code: 'A', name: 'Parada A', description: '', lat: 0, lon: 0, coordSource: 'kml' },
  B: { code: 'B', name: 'Parada B', description: '', lat: 0, lon: 0, coordSource: 'kml' },
};

function lineWith(directions: Line['directions']): Line {
  return {
    id: '1', name: 'L1', colour: '#fff', stopCodes: ['A', 'B'], directions, shapes: [], timesByStop: {},
    trips: { lab: [], sab: [], fes: [] },
  };
}

beforeAll(() => {
  initI18n('es');
});

describe('StopPicker', () => {
  it('con un solo sentido no escribe "Hacia …"', async () => {
    await render(<StopPicker line={lineWith([{ headsign: 'Circular', stopCodes: ['A', 'B'] }])} stops={stops} onSelect={() => {}} />);
    expect(screen.getByText('Parada A')).toBeTruthy();
    expect(screen.queryByText(/Hacia/)).toBeNull();
  });

  it('con dos sentidos escribe un "Hacia …" por sentido', async () => {
    await render(
      <StopPicker
        line={lineWith([
          { headsign: 'Norte', stopCodes: ['A'] },
          { headsign: 'Sur', stopCodes: ['B'] },
        ])}
        stops={stops}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('Hacia Norte')).toBeTruthy();
    expect(screen.getByText('Hacia Sur')).toBeTruthy();
  });
});
