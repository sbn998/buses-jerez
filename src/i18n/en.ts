// Textos de la app en inglés. Misma estructura de claves que es.ts.
import type es from './es';

// El tipo obliga a que las claves coincidan con las de es.ts.
type Textos = typeof es;

const en: Textos = {
  tabs: {
    nearby: 'Nearby',
    schedules: 'Timetables',
    directions: 'Directions',
    lines: 'Lines',
    topup: 'Top-up',
  },
  common: {
    comingSoon: 'Coming soon',
  },
};

export default en;
