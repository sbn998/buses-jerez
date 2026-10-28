// Prueba del componente ComingSoon: debe mostrar el título y "Próximamente".
import { render, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';

import { ComingSoon } from '../ComingSoon';

// Los textos salen de i18n, así que se inicia en español antes de probar.
beforeAll(() => {
  initI18n('es');
});

describe('ComingSoon', () => {
  it('muestra el título y el texto Próximamente', async () => {
    await render(<ComingSoon title="Cerca de mí" />);
    expect(screen.getByText('Cerca de mí')).toBeTruthy();
    expect(screen.getByText('Próximamente')).toBeTruthy();
  });
});
