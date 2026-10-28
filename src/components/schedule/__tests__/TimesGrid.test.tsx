// Pruebas de la rejilla de horas: marca la pasada y la siguiente, y avisa si no hay servicio.
import { render, screen, within } from '@testing-library/react-native';

import { initI18n } from '@/i18n';

import { TimesGrid } from '../TimesGrid';

beforeAll(() => {
  initI18n('es');
});

const times = ['07:28', '10:14', '10:37'];
const now = new Date(2026, 9, 28, 10, 5); // 10:05

describe('TimesGrid', () => {
  it('marca como pasada la 07:28 y como siguiente la 10:14', async () => {
    await render(<TimesGrid times={times} now={now} highlightNext />);
    expect(within(screen.getByTestId('time-past')).getByText('07:28')).toBeTruthy();
    expect(within(screen.getByTestId('time-next')).getByText('10:14')).toBeTruthy();
    expect(screen.getAllByTestId('time-past')).toHaveLength(1);
  });

  it('sin highlightNext no marca ninguna', async () => {
    await render(<TimesGrid times={times} now={now} highlightNext={false} />);
    expect(screen.queryByTestId('time-past')).toBeNull();
    expect(screen.queryByTestId('time-next')).toBeNull();
  });

  it('shows no service message', async () => {
    await render(<TimesGrid times={[]} highlightNext={false} />);
    expect(screen.getByText('Sin servicio este día')).toBeTruthy();
  });
});
