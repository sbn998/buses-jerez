// Pestaña "Cómo llego": de momento solo muestra "Próximamente".
import { ComingSoon } from '@/components/ComingSoon';

export default function ComoLlego() {
  return <ComingSoon />;
}

// Si esta pantalla falla, se muestra su propio aviso y la barra de pestañas sigue visible.
export { RouteError as ErrorBoundary } from '@/components/RouteError';
