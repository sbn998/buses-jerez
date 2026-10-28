// Pie de la pantalla: de dónde salen los horarios y cuándo se comprobaron por última vez.
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { useData } from '@/data/DataProvider';

export function DataFreshness() {
  const { t, i18n } = useTranslation();
  const { source, checkedAt } = useData();
  // Con la copia incluida (o sin fecha) no hay día de comprobación que enseñar.
  const text =
    source === 'downloaded' && checkedAt
      ? t('schedule.freshness', { date: new Date(checkedAt).toLocaleDateString(i18n.language) })
      : t('schedule.freshnessBundled');
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {text}
    </ThemedText>
  );
}
