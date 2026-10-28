// Pestaña "Cerca de mí": de momento solo muestra "Próximamente".
import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/ComingSoon';

export default function Cerca() {
  const { t } = useTranslation();
  return <ComingSoon title={t('tabs.nearby')} />;
}
