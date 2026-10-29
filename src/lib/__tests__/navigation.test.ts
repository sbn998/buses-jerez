// Pruebas de openSchedule: abre Horarios con línea, parada y un nonce nuevo cada vez.
import { openSchedule } from '../navigation';

describe('openSchedule', () => {
  it('hace push a Horarios con line, stop y nonce (la hora actual en texto)', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);
    const push = jest.fn();
    openSchedule({ push }, '1', '343');
    expect(push).toHaveBeenCalledWith({
      pathname: '/(tabs)/horarios',
      params: { line: '1', stop: '343', nonce: '1234567890' },
    });
    jest.restoreAllMocks();
  });
});
