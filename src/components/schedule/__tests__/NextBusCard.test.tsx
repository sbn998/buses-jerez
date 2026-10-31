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

  it('con 0 minutos dice "ahora" en vez de "en 0 min"', async () => {
    await render(<NextBusCard departures={[{ time: '10:14', minutesUntil: 0 }]} headsign={null} />);
    expect(screen.getByText('ahora')).toBeTruthy();
    expect(screen.queryByText('en 0 min')).toBeNull();
  });
});

describe('NextBusCard con nota', () => {
  it('muestra la nota del próximo bus debajo de la hora', async () => {
    await render(
      <NextBusCard departures={[{ time: '21:38', minutesUntil: 5 }]} headsign={null} note="Solo hasta Moreno Mendoza" />,
    );
    expect(screen.getByText('Solo hasta Moreno Mendoza')).toBeTruthy();
  });
});
