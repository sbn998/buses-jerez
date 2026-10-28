// Pie de la pantalla: de dónde salen los horarios y cuándo se comprobaron por última vez.
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { useData } from '@/data/DataProvider';

export function DataFreshness() {
  const { t, i18n } = useTranslation();
  const { data, source, checkedAt } = useData();
  const format = (iso: string) => new Date(iso).toLocaleDateString(i18n.language);
  // Siempre se enseña una fecha: la de comprobación si hay datos descargados y,
  // con la copia incluida en la app, la de cuando se generaron esos horarios.
  const text =
    source === 'downloaded' && checkedAt
      ? t('schedule.freshness', { date: format(checkedAt) })
      : t('schedule.freshnessBundled', { date: format(data.generatedAt) });
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {text}
    </ThemedText>
  );
}
