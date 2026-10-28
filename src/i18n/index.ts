// Configuración de idiomas (i18next): elige el idioma y carga los textos es/en.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en';
import es from './es';

export type Language = 'auto' | 'es' | 'en';

// Decide el idioma final. "auto" usa el del móvil: español si lo es, inglés en cualquier otro caso.
// Si no se puede saber el idioma del móvil (null), se usa español.
export function resolveLanguage(
  setting: Language,
  deviceLanguageCode: string | null,
): 'es' | 'en' {
  if (setting !== 'auto') return setting;
  if (deviceLanguageCode === null) return 'es';
  return deviceLanguageCode === 'es' ? 'es' : 'en';
}

// Arranca i18next con el idioma dado. Si ya estaba arrancado, solo cambia de idioma.
export function initI18n(lang: 'es' | 'en') {
  if (i18n.isInitialized) {
    // Solo se cambia si de verdad es otro idioma: así no se avisa a las pantallas sin motivo.
    if (i18n.language !== lang) void i18n.changeLanguage(lang);
    return i18n;
  }
  void i18n.use(initReactI18next).init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: lang,
    fallbackLng: 'es',
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return i18n;
}

export default i18n;
