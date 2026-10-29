// Prueba de la tarjeta de una opción de ruta: textos, insignias y toque.
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Line, Stop } from '@/data/schema';
import { initI18n } from '@/i18n';
import type { BusLeg, RouteOption, WalkEstimate } from '@/lib/planner';

import { RouteOptionCard } from '../RouteOptionCard';

beforeAll(() => {
  initI18n('es');
});

const stop = (code: string, name: string): Stop => ({
  code,
  name,
  description: '',
  lat: 36.68,
  lon: -6.13,
  coordSource: 'kml',
});
const line = (id: string, colour: string): Line => ({
  id,
  name: `Línea ${id}`,
  colour,
  stopCodes: [],
  directions: [],
  shapes: [],
  timesByStop: {},
  trips: { lab: [], sab: [], fes: [] },
});
const walk = (meters: number): WalkEstimate => ({ meters, minutes: Math.ceil(meters / 80), approximate: true });
const leg = (l: Line, from: Stop, to: Stop, departure: string, arrival: string): BusLeg => ({
  line: l,
  from,
  to,
  fromIndex: 0,
  toIndex: 1,
  departure,
  arrival,
});

const A = stop('A', 'Plaza Norte');
const B = stop('B', 'Cruce Central');
const C = stop('C', 'Hospital');

const direct: RouteOption = {
  id: 'x',
  legs: [leg(line('1', '#FFDE4D'), A, C, '10:05', '10:15')],
  walkToStop: walk(100),
  transferWalk: null,
  walkFromStop: walk(60),
  firstWaitMinutes: 3,
  transferWaitMinutes: null,
  arrivalMinutes: 620,
  totalMinutes: 20,
  walkMeters: 160,
};

const withTransfer: RouteOption = {
  ...direct,
  id: 'y',
  legs: [
    leg(line('1', '#FFDE4D'), A, B, '10:05', '10:15'),
    leg(line('4', '#CC0033'), B, C, '10:25', '10:40'),
  ],
  transferWaitMinutes: 10,
  totalMinutes: 45,
};

describe('RouteOptionCard', () => {
  it('un viaje directo enseña resumen, subida, bajada y la etiqueta de distancias aproximadas', async () => {
    await render(<RouteOptionCard option={direct} selected={false} onPress={() => {}} />);
    expect(screen.getByText('20 min · 160 m andando · directo')).toBeTruthy();
    expect(screen.getByText('Súbete en Plaza Norte a las 10:05 (a 100 m)')).toBeTruthy();
    expect(screen.getByText('Bájate en Hospital a las 10:15 (a 60 m del destino)')).toBeTruthy();
    expect(screen.getByText('Distancias aproximadas')).toBeTruthy();
    expect(screen.queryByText(/Transbordo en/)).toBeNull();
  });

  it('con un transbordo enseña dónde y cuánto se espera', async () => {
    await render(<RouteOptionCard option={withTransfer} selected={false} onPress={() => {}} />);
    expect(screen.getByText('45 min · 160 m andando · 1 transbordo')).toBeTruthy();
    expect(screen.getByText('Transbordo en Cruce Central: espera 10 min')).toBeTruthy();
    expect(screen.getByText('Bájate en Hospital a las 10:40 (a 60 m del destino)')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('la insignia usa el color de la línea', async () => {
    await render(<RouteOptionCard option={direct} selected={false} onPress={() => {}} />);
    expect(screen.getByTestId('badge-1')).toHaveStyle({ backgroundColor: '#FFDE4D' });
  });

  it('al tocarla avisa, y marca si está seleccionada', async () => {
    const onPress = jest.fn();
    const view = await render(<RouteOptionCard option={direct} selected={false} onPress={onPress} />);
    await fireEvent.press(screen.getByTestId('route-option-1'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('route-option-1').props.accessibilityState).toMatchObject({ selected: false });
    await view.rerender(<RouteOptionCard option={direct} selected onPress={onPress} />);
    expect(screen.getByTestId('route-option-1').props.accessibilityState).toMatchObject({ selected: true });
  });
});
