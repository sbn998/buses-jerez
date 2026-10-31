// Avisos que salen al abrir la app: horario caducado, cambio de horario próximo
// y avisos escritos a mano (pipeline/notices.json). Solo funciones puras.
import type { TFunction } from 'i18next';

import type { Dataset } from '@/data/schema';

/** Un aviso listo para enseñar: su id (para "No volver a mostrar") y el texto ya traducido. */
export interface AppNotice {
  id: string;
  text: string;
}

// Nombres de los meses para escribir "28 de junio" o "June 28" (sin depender de Intl).
const MONTHS = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

/** "2027-06-28" -> "28 de junio" en español o "June 28" en inglés. */
export function formatDayMonth(key: string, lang: 'es' | 'en'): string {
  const [, month, day] = key.split('-').map(Number);
  const name = MONTHS[lang][month - 1];
  return lang === 'es' ? `${day} de ${name}` : `${name} ${day}`;
}

/** Suma días a una fecha "AAAA-MM-DD" (en UTC, para que el cambio de hora no la mueva). */
export function addDays(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Los avisos que tocan hoy, por orden: horario caducado, cambio próximo (los 5 últimos días
 * del periodo) y avisos escritos a mano cuyo intervalo incluye hoy.
 * `today` es la fecha local "AAAA-MM-DD"; las fechas se comparan como texto.
 */
export function activeNotices(ds: Dataset, today: string, lang: 'es' | 'en', t: TFunction): AppNotice[] {
  const notices: AppNotice[] = [];
  const validTo = ds.period?.validTo;
  if (validTo && today > validTo) {
    notices.push({
      id: `period-expired-${validTo}`,
      text: t('notices.expired', { date: formatDayMonth(validTo, lang) }),
    });
  } else if (validTo && today >= addDays(validTo, -4)) {
    notices.push({
      id: `period-change-${validTo}`,
      text: t('notices.change', { date: formatDayMonth(addDays(validTo, 1), lang) }),
    });
  }
  for (const n of ds.notices ?? []) {
    if (n.from <= today && today <= n.to) notices.push({ id: n.id, text: n[lang] });
  }
  return notices;
}
