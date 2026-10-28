// Pestaña "Líneas": de momento solo muestra "Próximamente".
import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/ComingSoon';

export default function Lineas() {
  const { t } = useTranslation();
  return <ComingSoon title={t('tabs.lines')} />;
}
