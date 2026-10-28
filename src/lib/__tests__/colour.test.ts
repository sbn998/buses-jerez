// Prueba del helper de contraste: texto oscuro sobre colores claros y claro sobre oscuros.
import { textColourFor } from '../colour';

describe('textColourFor', () => {
  it('usa texto oscuro sobre amarillo claro', () => {
    expect(textColourFor('#FFDE4D')).toBe('#000000');
  });
  it('usa texto claro sobre azul oscuro', () => {
    expect(textColourFor('#0A2A66')).toBe('#FFFFFF');
  });
});
