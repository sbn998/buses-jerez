// Pruebas del store de ajustes (idioma elegido).
import { useSettings } from '../settings';

describe('useSettings', () => {
  it('empieza en auto', () => {
    expect(useSettings.getState().language).toBe('auto');
  });
  it('setLanguage cambia el idioma', () => {
    useSettings.getState().setLanguage('en');
    expect(useSettings.getState().language).toBe('en');
  });
});
