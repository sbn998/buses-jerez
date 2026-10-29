// Funciones pequeñas para dar formato a textos que se repiten en varias pantallas.
import type { TFunction } from 'i18next';

// Texto de "cuánto falta": "ahora" si faltan 0 minutos, y "en N min" en otro caso.
export function formatMinutes(minutes: number, t: TFunction): string {
  return minutes === 0 ? t('schedule.now') : t('schedule.inMinutes', { minutes });
}
