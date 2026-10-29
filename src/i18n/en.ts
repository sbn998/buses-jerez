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
  schedule: {
    chooseLine: 'Choose a line',
    chooseStop: 'Choose a stop',
    changeLine: 'Change line',
    changeStop: 'Change stop',
    lineLabel: 'Line {{id}}',
    towards: 'Towards {{headsign}}',
    favorites: 'Favourites',
    noFavorites: 'You have no favourites yet. Choose a line and a stop and tap the star to save them.',
    addFavorite: 'Add to favourites',
    removeFavorite: 'Remove from favourites',
    openFavorite: 'Open {{line}} at {{stop}}',
    nextBus: 'Next bus',
    thenBuses: 'Then',
    now: 'now',
    inMinutes: 'in {{minutes}} min',
    noMoreToday: 'No more buses today',
    noService: 'No service this day',
    allTimes: 'All times',
    today: 'Today',
    dayLab: 'Weekday',
    daySab: 'Saturday',
    dayFes: 'Sunday/holiday',
    selectDay: 'Show timetable for {{date}}',
    freshness: 'Official Comujesa timetables · checked on {{date}}',
    freshnessBundled: 'Official Comujesa timetables · copy included in the app, from {{date}}',
  },
  common: {
    comingSoon: 'Coming soon',
  },
  error: {
    title: 'Something went wrong',
    retry: 'Try again',
  },
  options: {
    title: 'Options',
    open: 'Open options',
    language: 'Language',
    langAuto: 'Automatic',
    langEs: 'Español',
    langEn: 'English',
    data: 'Data',
    source: 'Official data from Comujesa',
    offlineMap: 'Offline map',
    mapSoon: 'Coming soon',
  },
};

export default en;
