// Pruebas de la franja de avisos: "No volver a mostrar" es para siempre, cerrar solo hasta reabrir.
// Se usa lo que devuelve cada render (no `screen`), porque aquí se desmonta y se vuelve a montar.
import { fireEvent, render } from '@testing-library/react-native';

import { initI18n } from '@/i18n';
import { useDismissedNotices } from '@/stores/dismissedNotices';

import { NoticeBanner } from '../NoticeBanner';

// El icono de la X no hace falta en las pruebas (su fuente no se carga en Jest).
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);

beforeAll(() => {
  initI18n('es');
});

beforeEach(() => {
  useDismissedNotices.setState({ dismissed: [], closed: [] });
});

const first = { id: 'a', text: 'Primer aviso' };
const second = { id: 'b', text: 'Segundo aviso' };

describe('NoticeBanner', () => {
  it('"No volver a mostrar" lo oculta y sigue oculto al volver a montarlo', async () => {
    const view = await render(<NoticeBanner notices={[first]} />);
    await fireEvent.press(view.getByText('No volver a mostrar'));
    expect(view.queryByTestId('notice-banner')).toBeNull();
    await view.unmount();
    // Al reabrir la app se olvida lo cerrado, pero no lo descartado.
    useDismissedNotices.setState({ closed: [] });
    const again = await render(<NoticeBanner notices={[first]} />);
    expect(again.queryByTestId('notice-banner')).toBeNull();
    expect(useDismissedNotices.getState().isDismissed('a')).toBe(true);
  });

  it('cerrar lo oculta, pero sale otra vez al reabrir la app', async () => {
    const view = await render(<NoticeBanner notices={[first]} />);
    await fireEvent.press(view.getByLabelText('Cerrar aviso'));
    expect(view.queryByTestId('notice-banner')).toBeNull();
    await view.unmount();
    useDismissedNotices.setState({ closed: [] });
    const again = await render(<NoticeBanner notices={[first]} />);
    expect(again.getByText('Primer aviso')).toBeTruthy();
  });

  it('un aviso con otro id sale después de descartar el primero', async () => {
    const view = await render(<NoticeBanner notices={[first, second]} />);
    await fireEvent.press(view.getByText('No volver a mostrar'));
    expect(view.queryByText('Primer aviso')).toBeNull();
    expect(view.getByText('Segundo aviso')).toBeTruthy();
  });

  it('no enseña nada sin avisos', async () => {
    const view = await render(<NoticeBanner notices={[]} />);
    expect(view.queryByTestId('notice-banner')).toBeNull();
  });
});
