// Pruebas de idiomas: elección del idioma y que es/en tengan las mismas claves.
import en from '../en';
import es from '../es';
import { initI18n, resolveLanguage } from '../index';

// Convierte un objeto anidado en una lista de claves planas ("tabs.nearby", ...).
function aplanar(obj: Record<string, unknown>, prefijo = ''): string[] {
  return Object.entries(obj).flatMap(([clave, valor]) =>
    typeof valor === 'object' && valor !== null
      ? aplanar(valor as Record<string, unknown>, `${prefijo}${clave}.`)
      : [`${prefijo}${clave}`],
  );
}

describe('resolveLanguage', () => {
  it('auto con móvil en español da es', () => {
    expect(resolveLanguage('auto', 'es')).toBe('es');
  });
  it('auto con otro idioma da en', () => {
    expect(resolveLanguage('auto', 'ca')).toBe('en');
  });
  it('auto sin idioma detectado da es', () => {
    expect(resolveLanguage('auto', null)).toBe('es');
  });
  it('un idioma elegido manda sobre el del móvil', () => {
    expect(resolveLanguage('en', 'es')).toBe('en');
  });
});

describe('textos', () => {
  it('es y en tienen exactamente las mismas claves', () => {
    expect(aplanar(en).sort()).toEqual(aplanar(es).sort());
  });
});

describe('initI18n', () => {
  it('no avisa de cambio si el idioma es el mismo, y cambia si es otro', () => {
    const i18n = initI18n('es');
    const aviso = jest.fn();
    i18n.on('languageChanged', aviso);
    try {
      initI18n('es');
      expect(aviso).toHaveBeenCalledTimes(0);
      initI18n('en');
      expect(aviso).toHaveBeenCalledTimes(1);
      expect(i18n.language).toBe('en');
    } finally {
      i18n.off('languageChanged', aviso);
      initI18n('es');
    }
  });
});
