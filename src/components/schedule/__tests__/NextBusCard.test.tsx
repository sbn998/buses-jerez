// Pruebas de la tarjeta de próximo bus.
import { render, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';

import { NextBusCard } from '../NextBusCard';

beforeAll(() => {
  initI18n('es');
});

describe('NextBusCard', () => {
  it('sin salidas dice que no quedan buses hoy', async () => {
    await render(<NextBusCard departures={[]} headsign={null} />);
    expect(screen.getByText('No quedan buses hoy')).toBeTruthy();
  });

  it('muestra la siguiente salida en grande, los minutos y el sentido', async () => {
    await render(
      <NextBusCard
        departures={[
          { time: '10:14', minutesUntil: 9 },
          { time: '10:37', minutesUntil: 32 },
        ]}
        headsign="San Telmo"
      />,
    );
    expect(screen.getByText('10:14')).toBeTruthy();
    expect(screen.getByText('en 9 min')).toBeTruthy();
    expect(screen.getByText('10:37')).toBeTruthy();
    expect(screen.getByText('Hacia San Telmo')).toBeTruthy();
  });
});
