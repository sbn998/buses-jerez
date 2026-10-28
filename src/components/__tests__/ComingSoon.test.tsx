// Prueba del componente ComingSoon: debe mostrar el título y "Próximamente".
import { render, screen } from '@testing-library/react-native';

import { ComingSoon } from '../ComingSoon';

describe('ComingSoon', () => {
  it('muestra el título y el texto Próximamente', async () => {
    await render(<ComingSoon title="Cerca de mí" />);
    expect(screen.getByText('Cerca de mí')).toBeTruthy();
    expect(screen.getByText('Próximamente')).toBeTruthy();
  });
});
