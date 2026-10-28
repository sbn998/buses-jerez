# Plan 2: app base (datos, pestañas, idiomas, Horarios y Favoritos)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una app Android instalada en el móvil del autor (development build de Expo) con las 5 pestañas, español e inglés, datos que funcionan sin conexión y se actualizan solos, y la pantalla **Horarios** completa (línea, parada, calendario por tipo de día, próximo bus, horario del día) con **Favoritos**.

**Architecture:** La lógica que decide qué se muestra (tipo de día, próximas salidas, actualización de datos) vive en funciones puras de `src/lib/`, probadas con Jest. El estado guardado en el móvil (idioma, favoritos) va en stores de `zustand` con persistencia en AsyncStorage. Los datos se cargan en este orden: copia descargada en el móvil, y si no hay, la copia incluida en la app. Al abrir la app se consulta el manifiesto publicado y, si la versión cambió, se descarga `data.json`. Las pantallas de `src/app/` solo componen componentes de `src/components/`.

**Tech Stack:** Expo SDK 58, expo-router (`Tabs`), TypeScript, `jest-expo` + `@testing-library/react-native`, `i18next` + `react-i18next` + `expo-localization`, `zustand` + `@react-native-async-storage/async-storage`, `expo-file-system`, `@expo/vector-icons`, `expo-dev-client` + EAS Build.

**Fuera de este plan:** los avisos al abrir la app pasan al Plan 5, porque necesitan las fechas de cambio de horario que saca el OCR. La pantalla Opciones (con el selector de idioma) va en el Plan 3. En este plan el idioma sigue al del móvil, aunque el ajuste ya queda guardado.

**Spec:** `docs/superpowers/specs/2026-10-28-buses-jerez-design.md` (3.1, 3.2 Horarios, 3.4, 3.5, 3.6 "App", 4.1, 7.1). Contrato de datos: `src/data/schema.ts`.

## Global Constraints
- Coste cero: sin tarjeta en ningún servicio. EAS Build en su capa gratuita. Si se agota, se compila en local.
- Nunca claves ni información personal en el repo. El `.gitignore` es de lista blanca: no hace falta añadir carpetas (todo va en `src/`, `assets/` y archivos raíz ya permitidos), salvo `eas.json`, que se permite explícitamente.
- Commits con `193912679+sbn998@users.noreply.github.com` y sin líneas de atribución.
- **Explicado para principiantes:** cada archivo nuevo empieza con un comentario en español que dice para qué sirve, y las funciones no triviales llevan un comentario corto. Al terminar cada tarea, se explica al autor en el chat qué se ha hecho, sin jerga.
- Datos: `https://sbn998.github.io/buses-jerez/manifest.json` y `…/data.json`. Solo se aceptan datos con `schemaVersion === 1`.
- Tipos de día (Comujesa): sábado → `sab`; domingo o festivo (`Dataset.holidays`) → `fes`; resto → `lab`. Se usa la fecha local del móvil.
- Horarios: **sin preselección automática** de línea ni parada, y **sin botón "elegir día y hora"** (decisiones del autor).
- Textos de la interfaz siempre con i18n (`t('…')`). Nunca texto fijo en las pantallas. Los nombres de paradas y líneas no se traducen.
- Pestañas en este orden: Cerca de mí · Horarios · Cómo llego · Líneas · Recarga. En este plan solo Horarios tiene contenido. Las otras 4 muestran "Próximamente" (planes 3 y 4).

## Review Focus
1. **Después del último bus del día** (por ejemplo, a las 23:30): la tarjeta del próximo bus debe decir que no quedan buses hoy, no mostrar el de las 07:28 como "en 8 h" ni quedarse vacía. Lo prueba la Task 3 (`no more buses today`).
2. **Festivo entre semana** (por ejemplo, 2026-05-11, festivo local): el calendario debe marcarlo como festivo y Horarios debe abrir el horario de domingos y festivos. Lo prueba la Task 3 (`local holiday is fes`).
3. **Primera vez sin conexión**: sin copia descargada ni red, la app debe abrir con la copia incluida y no quedarse cargando. Lo prueba la Task 4 (`falls back to bundled when offline`).
4. **Copia descargada rota o de otra versión del contrato** (archivo a medias o `schemaVersion: 2`): se ignora y se usa la incluida. Nunca se debe colgar la app. Lo prueba la Task 4 (`ignores corrupt or future cache`).
5. **Parada sin horas el tipo de día elegido** (muchas no tienen servicio en festivos): debe salir un mensaje claro ("Sin servicio este día"), no una lista vacía. Lo prueba la Task 6 (`shows no service message`).

---

### Task 1: Limpiar la plantilla, pruebas y pestañas

**Files:**
- Delete: `src/app/explore.tsx`, `src/app/index.tsx`, `src/components/animated-icon.tsx`, `animated-icon.web.tsx`, `animated-icon.module.css`, `app-tabs.tsx`, `app-tabs.web.tsx`, `external-link.tsx`, `hint-row.tsx`, `web-badge.tsx`, `ui/collapsible.tsx`, y las imágenes de la plantilla que dejen de usarse (`expo-badge*`, `react-logo*`, `logo-glow`, `tutorial-web`, `tabIcons/`).
- Create: `src/app/_layout.tsx` (reescrito), `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/cerca.tsx`, `horarios.tsx`, `como-llego.tsx`, `lineas.tsx`, `recarga.tsx`, `src/components/ComingSoon.tsx`, `jest.config.js`
- Modify: `package.json` (script `"test": "jest"`, `"typecheck": "tsc --noEmit"`), `src/constants/theme.ts` (quitar el import de `global.css` si se borra)
- Test: `src/components/__tests__/ComingSoon.test.tsx`

**Interfaces:**
- Produces: rutas `/(tabs)/cerca`, `/(tabs)/horarios`, `/(tabs)/como-llego`, `/(tabs)/lineas`, `/(tabs)/recarga`. La ruta inicial es `cerca`. `ComingSoon({ title }: { title: string })`.

- [ ] **Step 1:** `npx expo install jest-expo jest @testing-library/react-native @types/jest @expo/vector-icons`. `jest.config.js` con `preset: 'jest-expo'` y `testPathIgnorePatterns: ['/node_modules/', '/pipeline/']`.
- [ ] **Step 2:** Test: `render(<ComingSoon title="Cerca de mí" />)` → se ven `"Cerca de mí"` y `"Próximamente"`. Con i18n en la Task 2, el texto saldrá de `t('common.comingSoon')`. De momento, texto fijo.
- [ ] **Step 3:** Run `npm test`. Expected: FAIL (componente no existe).
- [ ] **Step 4:** Borrar la plantilla. Crear `ComingSoon` y el layout de pestañas con `Tabs` de expo-router y estos iconos de `MaterialCommunityIcons`: `map-marker-radius` (Cerca de mí), `clock-outline` (Horarios), `directions` (Cómo llego), `bus-multiple` (Líneas), `credit-card-outline` (Recarga). `horarios.tsx` muestra de momento `ComingSoon`.
- [ ] **Step 5:** Run `npm test` y `npm run typecheck`. Expected: PASS y 0 errores de tipos (desaparecen los 3 errores de la plantilla).
- [ ] **Step 6:** Commit `chore(app): quitar plantilla, añadir pruebas y 5 pestañas`.

### Task 2: Idiomas (español e inglés) y ajustes guardados

**Files:**
- Create: `src/i18n/index.ts`, `src/i18n/es.ts`, `src/i18n/en.ts`, `src/stores/settings.ts`
- Modify: `src/app/_layout.tsx` (iniciar i18n), `src/app/(tabs)/_layout.tsx` y `ComingSoon.tsx` (usar `t`)
- Test: `src/i18n/__tests__/i18n.test.ts`, `src/stores/__tests__/settings.test.ts`

**Interfaces:**
- Produces:
  - `type Language = 'auto' | 'es' | 'en'`
  - `resolveLanguage(setting: Language, deviceLanguageCode: string | null): 'es' | 'en'`: `'auto'` → `'es'` si el móvil está en español, `'en'` en cualquier otro idioma.
  - `useSettings`: store de zustand persistido (clave `settings`) con `{ language: Language; setLanguage(l: Language): void }`. Valor inicial `'auto'`.
  - `initI18n(lang: 'es' | 'en')`. `es.ts` y `en.ts` exportan el mismo objeto de claves. Claves iniciales: `tabs.nearby/schedules/directions/lines/topup`, `common.comingSoon`. Las tareas siguientes añaden las suyas.

- [ ] **Step 1:** Tests:
  - `resolveLanguage('auto','es')` → `'es'`. `('auto','ca')` → `'en'`. `('auto',null)` → `'es'`. `('en','es')` → `'en'`.
  - `es` y `en` tienen exactamente las mismas claves (comparar las claves aplanadas).
  - `useSettings.getState().setLanguage('en')` → `getState().language === 'en'`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar. `npx expo install expo-localization @react-native-async-storage/async-storage` y `npm i i18next react-i18next zustand`. El idioma del móvil se lee con `getLocales()[0]?.languageCode` de expo-localization.
  - Textos de las pestañas en español: "Cerca de mí", "Horarios", "Cómo llego", "Líneas", "Recarga". En inglés: "Nearby", "Timetables", "Directions", "Lines", "Top-up".
  - "Próximamente" / "Coming soon".
- [ ] **Step 4:** Run `npm test` y `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): español e inglés`.

### Task 3: Lógica de horarios (tipo de día y próximas salidas)

**Files:**
- Create: `src/lib/schedule.ts`
- Test: `src/lib/__tests__/schedule.test.ts`

**Interfaces:**
- Consumes: `DayType`, `Holiday`, `TimeOfDay`, `Line` de `src/data/schema.ts`.
- Produces:
  - `toDateKey(d: Date): string`: `"AAAA-MM-DD"` en hora local.
  - `dayTypeFor(d: Date, holidays: Holiday[]): DayType`
  - `holidayFor(d: Date, holidays: Holiday[]): Holiday | undefined`
  - `minutesOfDay(t: TimeOfDay): number`
  - `nextDepartures(times: TimeOfDay[], now: Date, count: number): { time: TimeOfDay; minutesUntil: number }[]`: solo horas ≥ ahora (al minuto), y vacío si ya no quedan.
  - `headsignFor(line: Line, stopCode: string): string | null`: el `headsign` del sentido que contiene la parada.
  - `calendarDays(start: Date, count: number, holidays: Holiday[]): { date: Date; key: string; dayType: DayType; holiday?: Holiday }[]`

- [ ] **Step 1:** Tests (fechas con `new Date(2026, mes, día, h, m)` en hora local):
  - `weekday is lab`: miércoles 2026-10-28 → `'lab'`. `saturday is sab`: 2026-10-31 → `'sab'`. `sunday is fes`: 2026-11-01 → `'fes'`.
  - `local holiday is fes`: lunes 2026-05-11 con `holidays=[{date:'2026-05-11',name:'Fiesta local de Jerez',scope:'local'}]` → `'fes'`, y `holidayFor` devuelve ese festivo.
  - `next departures`: `times=['07:28','10:14','10:37','11:01']`, ahora 10:05 → `[{time:'10:14',minutesUntil:9},{time:'10:37',minutesUntil:32}]` con `count=2`. Ahora 10:14 → la primera es `'10:14'` con `minutesUntil: 0`.
  - `no more buses today`: `times=['07:28','21:38']`, ahora 23:30 → `[]`.
  - `headsign`: línea con `directions=[{headsign:'San Telmo',stopCodes:['343']},{headsign:'Plaza Esteve',stopCodes:['302']}]` → `headsignFor(l,'302') === 'Plaza Esteve'` y `headsignFor(l,'999') === null`.
  - `calendar`: 14 días desde el miércoles 2026-10-28 → `[0].dayType 'lab'`, `[3].dayType 'sab'`, `[4].dayType 'fes'` y `length 14`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): lógica de tipos de día y próximas salidas`.

### Task 4: Datos: copia incluida, caché y actualización

**Files:**
- Create: `src/data/bundled.json` (copia de `https://sbn998.github.io/buses-jerez/data.json`), `scripts/update-bundled-data.mjs`, `src/lib/dataSync.ts`, `src/data/DataProvider.tsx`
- Modify: `.gitignore` (añadir `!/scripts/` y `!/eas.json`, que se usa en la Task 7), `package.json` (script `"update-data": "node scripts/update-bundled-data.mjs"`), `src/app/_layout.tsx` (envolver en `DataProvider`)
- Test: `src/lib/__tests__/dataSync.test.ts`

**Interfaces:**
- Consumes: `Dataset`, `Manifest`, `SCHEMA_VERSION`.
- Produces:
  - `interface Stored { version: string; checkedAt: string; data: Dataset }`
  - `parseStored(json: string | null): Stored | null`: null si está vacío, roto o con `data.schemaVersion !== 1`.
  - `pickDataset(stored: Stored | null, bundled: Dataset): { data: Dataset; source: 'downloaded' | 'bundled'; checkedAt: string | null }`
  - `syncData(deps: { fetchText(url: string): Promise<string>; readStored(): Promise<string | null>; writeStored(json: string): Promise<void>; now(): Date }, current: Stored | null): Promise<Stored | null>`. Descarga el manifiesto. Si `version` coincide, devuelve `current` con `checkedAt` nuevo, guardado. Si cambia, descarga `data.json`, comprueba `schemaVersion === 1`, lo guarda y lo devuelve. Ante cualquier error, devuelve `current` sin tocar nada.
  - `useData(): { data: Dataset; source: 'downloaded' | 'bundled'; checkedAt: string | null }` (contexto de `DataProvider`). `DataProvider` carga lo guardado con `expo-file-system` (archivo `data-cache.json` en el directorio de documentos), muestra los datos al momento y lanza `syncData` en segundo plano al abrir la app.

- [ ] **Step 1:** Tests con dependencias falsas:
  - `falls back to bundled when offline`: `readStored` → null y `fetchText` rechaza → `syncData` devuelve null. `pickDataset(null, bundled)` → `source 'bundled'`.
  - `ignores corrupt or future cache`: `parseStored('{"version":')` → null. `parseStored` con `data.schemaVersion: 2` → null.
  - `same version only updates checkedAt`: con el manifiesto en la misma versión, `fetchText` se llama 1 vez (solo el manifiesto), el resultado tiene `checkedAt` = `now()` y se llama a `writeStored`.
  - `new version downloads data`: con versión distinta, se descarga `data.json`, se guarda y se devuelve con la `version` nueva.
  - `rejects downloaded data with other schema`: si `data.json` trae `schemaVersion: 2`, se devuelve `current` y no se llama a `writeStored`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar. `npx expo install expo-file-system`. El script `update-bundled-data.mjs` descarga `data.json`, comprueba `schemaVersion === 1` y que hay 18 líneas, y lo escribe en `src/data/bundled.json`. Ejecutarlo una vez y hacer commit del resultado (unos 1,1 MB).
- [ ] **Step 4:** Run `npm test` y `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): datos sin conexión con actualización automática`.

### Task 5: Favoritos

**Files:**
- Create: `src/stores/favorites.ts`
- Test: `src/stores/__tests__/favorites.test.ts`

**Interfaces:**
- Produces: `interface Favorite { lineId: string; stopCode: string }`. `useFavorites`: store persistido (clave `favorites`) con `{ items: Favorite[]; toggle(f: Favorite): void; isFavorite(f: Favorite): boolean }`. Los favoritos se ordenan por fecha de alta, el más nuevo primero.

- [ ] **Step 1:** Tests: `toggle` añade. Un segundo `toggle` del mismo quita. No hay duplicados. `isFavorite` refleja el estado. El orden es el más nuevo primero.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): favoritos`.

### Task 6: Pantalla Horarios

**Files:**
- Create: `src/components/schedule/LinePicker.tsx`, `StopPicker.tsx`, `DayStrip.tsx`, `NextBusCard.tsx`, `TimesGrid.tsx`, `FavoritesList.tsx`, `DataFreshness.tsx`
- Modify: `src/app/(tabs)/horarios.tsx`, `src/i18n/es.ts`, `src/i18n/en.ts`
- Test: `src/components/schedule/__tests__/TimesGrid.test.tsx`, `NextBusCard.test.tsx`, `src/app/__tests__/horarios.test.tsx`

**Interfaces:**
- Consumes: `useData` (Task 4), `schedule.ts` (Task 3), `useFavorites` (Task 5), `t`.
- Produces: `horarios.tsx` acepta los parámetros de ruta `?line=<id>&stop=<code>`, que usarán Cerca de mí y Líneas en el Plan 3.
  - `TimesGrid({ times, now?, highlightNext }: { times: TimeOfDay[]; now?: Date; highlightNext: boolean })`
  - `NextBusCard({ departures, headsign }: { departures: { time: TimeOfDay; minutesUntil: number }[]; headsign: string | null })`
  - `DayStrip({ days, selectedKey, onSelect })`

Comportamiento (spec 3.2):
- Sin línea elegida: arriba, la lista de Favoritos (línea + parada + próximo bus). Si no hay favoritos, un texto que explica cómo añadirlos. Debajo, el selector de línea.
- Al elegir línea: selector de parada con las paradas en orden de recorrido, agrupadas por sentido ("Hacia San Telmo").
- Con línea y parada: estrella de favorito, tira de 14 días (hoy seleccionado, colores distintos para laborable, sábado y festivo, con leyenda), tarjeta de próximo bus (solo si el día elegido es hoy: la siguiente salida en grande con "en N min" y las 3 siguientes) y rejilla de horas (pasadas en gris y la siguiente resaltada, solo hoy). Si es festivo, se muestra su nombre.
- Pie: `DataFreshness`, "Horarios oficiales de Comujesa · comprobados el {fecha}". Si los datos son la copia incluida, "copia incluida en la app".
- Cada línea muestra su número sobre su color, con texto oscuro o claro según el contraste.

- [ ] **Step 1:** Tests:
  - `TimesGrid`: con `times=['07:28','10:14','10:37']`, `now` 10:05 y `highlightNext` → `'07:28'` lleva la marca de pasada (`accessibilityState` o `testID` `time-past`) y `'10:14'` lleva `time-next`. Sin `highlightNext`, ninguna lleva marca.
  - `shows no service message`: `TimesGrid` con `times=[]` → se ve `t('schedule.noService')` ("Sin servicio este día").
  - `NextBusCard` con `departures=[]` → se ve `t('schedule.noMoreToday')` ("No quedan buses hoy").
  - `horarios` con los parámetros `line=1&stop=343` y unos datos de prueba pequeños → se ven el nombre de la parada, la tira de días y la estrella. Al pulsar la estrella, `useFavorites.getState().items` contiene `{lineId:'1',stopCode:'343'}`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar. Textos nuevos en `es.ts` y `en.ts` con las mismas claves (el test de claves de la Task 2 lo comprueba).
- [ ] **Step 4:** Run `npm test` y `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): pantalla Horarios`.

### Task 7: Development build e instalación en el móvil

**Files:**
- Create: `eas.json`
- Modify: `app.json` (`android.package: "com.sbn998.busesjerez"`, nombre visible `"Buses Jerez"`, plugins de `expo-dev-client`)

- [ ] **Step 1:** `npx expo install expo-dev-client`. `eas.json` con el perfil `development` (`developmentClient: true`, `distribution: "internal"`, `android.buildType: "apk"`).
- [ ] **Step 2 (lo hace el autor, una vez):** crear una cuenta gratuita en expo.dev (sin tarjeta) y ejecutar `npx eas login` en su terminal.
- [ ] **Step 3:** `npx eas build --profile development --platform android`. Expected: termina con un enlace a un APK. Si la capa gratuita está llena, alternativa local: `npx expo run:android` con Android Studio instalado.
- [ ] **Step 4 (autor):** instalar el APK en el móvil, ejecutar `npx expo start` en el ordenador y abrir el proyecto desde la app de desarrollo.
- [ ] **Step 5 (autor, verificación):** se ven las 5 pestañas. En Horarios: elegir la línea 1 y Plaza Esteve → próximo bus y horas coinciden con la web de Comujesa. Con el modo avión activado y la app reabierta, Horarios sigue funcionando. El cambio de idioma del móvil a inglés cambia los textos.
- [ ] **Step 6:** Commit `chore(app): development build`.
