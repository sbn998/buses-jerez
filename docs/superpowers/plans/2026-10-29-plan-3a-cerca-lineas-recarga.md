# Plan 3a: Cerca de mí, Líneas, Recarga y Opciones (sin mapa)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Las pestañas Cerca de mí, Líneas y Recarga funcionan como listas, sin conexión. El engranaje abre **Opciones** (idioma y fecha de los datos). Además, la app queda más robusta: un error de datos no la tumba, y Horarios se puede reabrir siempre desde otras pantallas.

**Architecture:** Igual que el Plan 2. La lógica va en funciones puras de `src/lib/` probadas con Jest (distancias, paradas cercanas, agrupar puntos de recarga). Las pantallas componen componentes de `src/components/<pantalla>/`. La ubicación sale de `expo-location`, envuelta en un hook. Los puntos de recarga se publican en `data.json` como un campo opcional nuevo, que sale de un archivo manual del pipeline. Un aviso mensual en GitHub te recuerda revisarlo si cambia el cartel oficial.

**Tech Stack:** el del Plan 2, más `expo-location`.

**Spec:** `docs/superpowers/specs/2026-10-28-buses-jerez-design.md` (3.2 Cerca de mí, Líneas, Recarga, Opciones; 3.4 Favoritos; 4.1).

**Fuera de este plan (Plan 3b):** todos los mapas (mapa propio de Jerez, MapLibre, mapa en Cerca de mí, Líneas y Recarga, descarga del mapa sin conexión en Opciones) y el cruce de paradas con OSM. En este plan, donde el diseño pone un mapa, va un espacio reservado con el texto "El mapa llegará pronto".

## Global Constraints
- Coste cero, nada de claves ni información personal en el repo, `.gitignore` de lista blanca, commits con `193912679+sbn998@users.noreply.github.com` y sin líneas de atribución.
- **Explicado para principiantes:** cada archivo nuevo empieza con un comentario en español que dice para qué sirve, y las funciones no triviales llevan un comentario corto. Al terminar cada tarea, se explica al autor en el chat qué se ha hecho, sin jerga.
- Todo texto de la interfaz va con i18n, con las mismas claves en `es.ts` y `en.ts`. Los nombres de paradas, líneas y comercios no se traducen.
- **Nada de información falsa.** Las horas siempre salen de `schedule.ts` (`dayTypeFor` con festivos, `nextDepartures`) con `useNow()`. Una parada con `approximate: true` se marca como "ubicación aproximada" allí donde se muestre su distancia.
- **Sin conexión:** Cerca de mí, Líneas y Recarga funcionan sin internet. El GPS no necesita red.
- Horarios: sin preselección automática. Las otras pantallas abren Horarios con `router.push({ pathname: '/(tabs)/horarios', params: { line, stop, nonce } })`, donde `nonce` = `Date.now()` en texto.
- Distancias en línea recta (haversine). Minutos andando = `ceil(metros / 80)` (unos 4,8 km/h). Radio de Cerca de mí: 500 m.
- Contrato de datos: `src/data/schema.ts`. Solo se añade el campo opcional `topUpPoints`; `schemaVersion` sigue en 1.

## Review Focus
1. **Permiso de ubicación denegado o GPS sin señal:** Cerca de mí no se queda en blanco ni cargando para siempre. Explica qué pasa y ofrece un botón para volver a pedir el permiso, o para abrir los ajustes si ya se denegó del todo. Lo prueba la Task 4 (`denied`, `waiting`).
2. **Ninguna parada a menos de 500 m** (por ejemplo, en el campo o fuera de Jerez): se muestran las 3 más cercanas con su distancia real y un aviso. La lista nunca queda vacía. Lo prueba la Task 3 (`falls back to 3 nearest`).
3. **Parada con varias líneas, y alguna sin servicio hoy:** cada línea muestra su propio próximo bus, o "Sin servicio hoy". Ninguna línea se esconde. Lo prueba la Task 4 (`line without service today`).
4. **Volver a Horarios con la misma línea y parada** después de haber cambiado la selección: se aplica otra vez. Lo prueba la Task 2 (`same params with new nonce re-apply`).
5. **Datos rotos en una pantalla** (por ejemplo, una línea con `directions` vacío): se ve una pantalla de error con "Reintentar", no un cierre de la app. Lo prueba la Task 1 (`error boundary`).

---

### Task 1: Pantalla de error y Opciones

**Files:**
- Create: `src/components/ErrorBoundary.tsx`, `src/app/opciones.tsx`, `src/components/options/LanguagePicker.tsx`
- Modify: `src/app/_layout.tsx` (envolver el `Stack` en `ErrorBoundary` y registrar la ruta `opciones` como pantalla con cabecera y título traducido), `src/app/(tabs)/_layout.tsx` (botón de engranaje `cog-outline` en la cabecera de las 5 pestañas, que abre `/opciones`), `src/i18n/es.ts`, `src/i18n/en.ts`
- Test: `src/components/__tests__/ErrorBoundary.test.tsx`, `src/app/__tests__/opciones.test.tsx`

**Interfaces:**
- Produces: `ErrorBoundary({ children })`, un componente de clase con `getDerivedStateFromError`. Muestra `t('error.title')` ("Algo ha fallado") y un botón `t('error.retry')` ("Reintentar") que limpia el error y vuelve a pintar los hijos. En `__DEV__`, `componentDidCatch` hace `console.warn`.
- Opciones muestra: el idioma (Automático / Español / English, con `useSettings.setLanguage`); los datos (`DataFreshness` reutilizado, más la fuente: "Datos oficiales de Comujesa"); y un bloque "Mapa sin conexión" con `t('options.mapSoon')` ("Disponible pronto").

- [ ] **Step 1:** Tests:
  - `error boundary`: un hijo que lanza un error → se ve "Algo ha fallado". Se cambia el hijo para que ya no falle, se pulsa "Reintentar" y se ve el contenido del hijo. Con `console.error`/`console.warn` espiados para que la salida quede limpia.
  - `opciones`: al pulsar "English", `useSettings.getState().language === 'en'`. Se ve el pie de datos.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `npm test` y `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): pantalla de error y Opciones`.

### Task 2: Horarios se puede reabrir siempre, y "ahora"

**Files:**
- Modify: `src/app/(tabs)/horarios.tsx`, `src/components/schedule/NextBusCard.tsx`, `src/components/schedule/FavoritesList.tsx`, `src/i18n/es.ts`, `src/i18n/en.ts`
- Create: `src/lib/navigation.ts`
- Test: `src/app/__tests__/horarios.test.tsx` (ampliar), `src/components/schedule/__tests__/NextBusCard.test.tsx` (ampliar)

**Interfaces:**
- Produces: `openSchedule(router: { push: (href: any) => void }, lineId: string, stopCode: string): void`, en `src/lib/navigation.ts`. Hace `push` con `pathname: '/(tabs)/horarios'` y `params: { line, stop, nonce: String(Date.now()) }`. Las tasks 4 y 5 la usan, y `FavoritesList` también.
- `horarios.tsx` vuelve a aplicar `line` y `stop` cuando cambia `nonce`, aunque `line` y `stop` sean los mismos.
- `formatMinutes(minutes: number, t)`: si es 0, `t('schedule.now')` ("ahora" / "now"); si no, `t('schedule.inMinutes', { minutes })`. Va en el mismo `navigation.ts`, o en `src/lib/format.ts` si se prefiere; lo usan NextBusCard, FavoritesList y Cerca de mí.

- [ ] **Step 1:** Tests:
  - `same params with new nonce re-apply`: se monta con `line=1&stop=343&nonce=1`, se cambia de línea en la pantalla, se vuelve a renderizar con `line=1&stop=343&nonce=2` → la parada 343 de la línea 1 vuelve a estar elegida.
  - `NextBusCard` con `minutesUntil: 0` → muestra "ahora".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `npm test` y `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): reabrir Horarios con los mismos parámetros y "ahora"`.

### Task 3: Lógica de paradas cercanas

**Files:**
- Create: `src/lib/geo.ts`, `src/lib/nearby.ts`
- Test: `src/lib/__tests__/geo.test.ts`, `src/lib/__tests__/nearby.test.ts`

**Interfaces:**
- Produces:
  - `distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number` (haversine, radio terrestre 6 371 000 m).
  - `walkingMinutes(meters: number): number` = `Math.max(1, Math.ceil(meters / 80))`.
  - `interface NearbyStop { stop: Stop; meters: number; minutes: number; lines: Line[] }`. `lines` son las líneas cuyo `stopCodes` contiene la parada, ordenadas por `id` numérico.
  - `nearbyStops(data: Dataset, from: { lat: number; lon: number }, radius = 500, fallbackCount = 3): { items: NearbyStop[]; withinRadius: boolean }`. Devuelve las paradas a menos de `radius`, ordenadas por distancia. Si no hay ninguna, devuelve las `fallbackCount` más cercanas con `withinRadius: false`. Solo cuenta las paradas que salen en alguna línea.

- [ ] **Step 1:** Tests:
  - `distanceMeters` entre Plaza Esteve (36.681745, -6.136679) y Villamarta (36.683371, -6.135114) está entre 215 y 235 m.
  - `walkingMinutes(0) === 1`, `(80) === 1`, `(81) === 2`, `(400) === 5`.
  - `nearbyStops`: con 3 paradas de prueba a 100 m, 300 m y 900 m → 2 resultados ordenados, con `withinRadius: true`.
  - `falls back to 3 nearest`: desde un punto a 5 km de todas → 3 resultados, con `withinRadius: false`.
  - `lines`: una parada en las líneas "10" y "2" → `lines` ordenadas `['2','10']`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): cálculo de paradas cercanas`.

### Task 4: Pantalla Cerca de mí (lista)

**Files:**
- Create: `src/hooks/use-location.ts`, `src/components/nearby/NearbyStopCard.tsx`, `src/components/nearby/LocationState.tsx`
- Modify: `src/app/(tabs)/cerca.tsx`, `src/i18n/es.ts`, `src/i18n/en.ts`, `app.json` (plugin `expo-location` con el texto del permiso en español: "Para mostrarte las paradas más cercanas")
- Test: `src/hooks/__tests__/use-location.test.ts`, `src/app/__tests__/cerca.test.tsx`

**Interfaces:**
- Consumes: `nearbyStops` (Task 3), `openSchedule` y `formatMinutes` (Task 2), `useNow`, `useData`, `useFavorites`, `findLineStop`, `schedule.ts`.
- Produces: `useLocation(): { status: 'asking' | 'denied' | 'blocked' | 'waiting' | 'ready'; coords: { lat: number; lon: number } | null; retry(): void }`. Usa `requestForegroundPermissionsAsync` y `watchPositionAsync` (precisión Balanced, cada 25 m), y limpia la suscripción al desmontar. `blocked` es cuando `canAskAgain` es false. `waiting` es con el permiso dado pero sin posición todavía.

Comportamiento (spec 3.2, boceto `docs/superpowers/specs/2026-10-28-bocetos/cerca-de-mi.png`, aprobado):
- Arriba, los **Favoritos** con su próximo bus (se reutiliza `FavoritesList` o se extrae su fila). Debajo, "Paradas a menos de 500 m".
- Espacio reservado del mapa: un recuadro bajo con "El mapa llegará pronto".
- La parada más cercana aparece abierta: cada línea con su insignia, "hacia {headsign}" y el próximo bus (`formatMinutes`). Si la línea no tiene servicio hoy, sale "Sin servicio hoy". Las demás paradas aparecen plegadas, con las insignias de sus líneas, y se abren al tocarlas.
- Distancia "120 m · 2 min". Si la parada tiene `approximate`, se añade "· ubicación aproximada".
- Si `withinRadius` es false: aviso "No hay paradas a menos de 500 m. Estas son las más cercanas".
- Al tocar una línea dentro de una parada → `openSchedule`.
- Estados de `LocationState`: `asking` ("Pidiendo permiso…"), `denied` (explicación y botón "Permitir ubicación" → `retry`), `blocked` (explicación y botón "Abrir ajustes" → `Linking.openSettings()`), `waiting` ("Buscando tu posición…"). En todos ellos los Favoritos siguen visibles.

- [ ] **Step 1:** Tests (con `expo-location` simulado con `jest.mock`):
  - `use-location`: permiso concedido → `waiting` y, tras la primera posición, `ready` con `coords`. Permiso denegado con `canAskAgain: true` → `denied`. Con `canAskAgain: false` → `blocked`. Al desmontar se llama a `remove()`.
  - `cerca` en `ready` con datos de prueba → se ve la parada más cercana abierta, con "hacia …" y la hora. Al pulsar la línea se llama a `router.push` con `params.line`, `params.stop` y un `nonce`.
  - `line without service today`: una parada con 2 líneas y una sin horas hoy → las 2 líneas se ven, y una dice "Sin servicio hoy".
  - `denied`: se ve el botón "Permitir ubicación" y, al pulsarlo, se llama a `retry`.
  - `waiting`: se ve "Buscando tu posición…".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar (`npx expo install expo-location`).
- [ ] **Step 4:** Run `npm test` y `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): Cerca de mí`.

### Task 5: Pantalla Líneas (lista y detalle)

**Files:**
- Create: `src/app/linea/[id].tsx`, `src/components/lines/LineRow.tsx`, `src/components/lines/StopRow.tsx`
- Modify: `src/app/(tabs)/lineas.tsx`, `src/app/_layout.tsx` (registrar `linea/[id]` con cabecera y título "Línea N"), `src/i18n/es.ts`, `src/i18n/en.ts`
- Test: `src/app/__tests__/lineas.test.tsx`, `src/app/__tests__/linea-detalle.test.tsx`

**Interfaces:**
- Consumes: `openSchedule` (Task 2), `LineBadge` (Plan 2), `useData`.
- Lista: las 18 líneas en orden numérico, cada una con su insignia de color y su nombre ("Esteve - San Telmo"). Al tocar una se va a `/linea/<id>`.
- Detalle:
  - Espacio reservado del mapa.
  - Un bloque por cada sentido: "Hacia {headsign}", con sus paradas en orden, numeradas.
  - Si la línea solo tiene 1 sentido, el bloque se titula "Recorrido" y no "Hacia …", para no inventar un sentido que no está en los datos.
  - Cada parada muestra su nombre y, si es aproximada, "ubicación aproximada".
  - Al tocar una parada → `openSchedule(router, id, code)`.
  - Si `id` no existe → mensaje "Línea no encontrada" y un botón para volver.

- [ ] **Step 1:** Tests:
  - `lineas`: se ven 18 filas, la primera es la línea 1, y al pulsarla se navega a `/linea/1`.
  - `linea-detalle` con una línea de 2 sentidos → 2 títulos "Hacia …" y las paradas en orden. Con una línea de 1 sentido → título "Recorrido". Al pulsar una parada se llama a `openSchedule`. Con un id desconocido → "Línea no encontrada".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `npm test` y `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): Líneas`.

### Task 6: Puntos de recarga (datos y pantalla)

**Files:**
- Create: `pipeline/topup-points.json`, `pipeline/src/topup.ts`, `pipeline/test/topup.test.ts`, `src/lib/topup.ts`, `src/components/topup/TopUpList.tsx`
- Modify: `src/data/schema.ts` (campo opcional), `pipeline/src/main.ts`, `pipeline/src/validate.ts` (comprobar `topUpPoints` si existe), `pipeline/src/checkHolidays.ts` y `.github/workflows/holidays.yml` (añadir la comprobación del cartel de recarga, ver abajo), `pipeline/README.md`, `src/app/(tabs)/recarga.tsx`, `src/i18n/es.ts`, `src/i18n/en.ts`, `src/data/bundled.json` (regenerado)
- Test: `pipeline/test/topup.test.ts`, `src/lib/__tests__/topup.test.ts`, `src/app/__tests__/recarga.test.tsx`

**Interfaces:**
- `schema.ts`:
  - `export interface TopUpPoint { name: string; address: string; zone: 'oficina' | 'centro' | 'oeste' | 'este' | 'norte' | 'sur'; note?: string }`
  - En `Dataset`: `topUpPoints?: TopUpPoint[]`.
- `pipeline/topup-points.json`: `{ "source": "https://www.comujesa.es/autobuses-urbanos/punto-venta-multiviaje", "posterImage": "/fileadmin/_processed_/3/9/csm_RedVenta_6caee5bb75.jpg", "checked": "2026-10-29", "points": [...] }`. Es una copia literal del cartel oficial ("Establecimientos de recarga") y del texto de la página. Contenido exacto:
  - **oficina:**
    - "Oficina de Atención al Usuario" · "C/ Latorre, 3 (dependencias de Jereyssa)"
    - "Estación de Autobuses" · "Plaza de la Estación, planta baja" · note "Solo mañanas, de 08:00 a 14:30"
  - **centro:**
    - "Estanco Capuchinos" · "Pq. Capuchinos, 1"
    - "Librería El Tintero" · "C/ Descalzos, 4"
    - "Kiosco Sto. Domingo" · "Avda. Marqués de Casa Domecq, 4"
    - "Prensa y Revistas Sta. Marta" · "Sto. Domingo, bloque 6, local 8,6"
    - "Prensa Souvenirs Golosinas" · "Plaza del Arenal, 9"
  - **oeste:**
    - "Prensa El Tempul" · "C/ Armas de Santiago, local 15"
    - "Papelería Arcosiris" · "Plaza del Cante Jondo, 1"
    - "Supermercado Esmeralda" · "C/ Viticultor, 2"
    - "Informática SL" · "Avda. Méjico, 1"
  - **este:**
    - "Papelería Olivar" · "Camino Albadalejo, 34"
    - "Papelería Ani" · "Glorieta Biarritz, local 16"
    - "Video World" · "Avda. Lola Flores, 1"
    - "Librería y Papelería El Retiro" · "Paseo de las Delicias, 29"
    - "Papelería Asta Regia" · "Urb. Princi Jerez, 2"
    - "Estanco n.º 22" · "C/ Paquera de Jerez, 23"
    - "Papelería Punto y Aparte" · "C/ El Pinar, local 35"
    - "Papelería Vallesequillo" · "Avda. Vallesequillo, 3"
    - "Papelería Ramírez" · "Urb. Parque Atlántico, C/ Mar, 3"
    - "Prensa y Revista La Colmena" · "Avda. Juan Carlos I, 3"
    - "Kiosco Paco" · "Ronda de los Alunados"
  - **norte:**
    - "Papelería Golden" · "Avda. La Comedia, 13"
    - "Papelería Palos Blancos" · "Avda. Espera, 1"
    - "Confitería Charito" · "Avda. Ingeniero Ángel Mayo, 12"
    - "Papelería Los Cedros" · "Avda. Buenos Aires, 1"
    - "Papelería San Joaquín" · "Avda. Lebrija, 12"
    - "Estanco n.º 6" · "Urb. El Almendral, 10"
  - **sur:**
    - "Kiosco Jesús Clavijo" · "C/ Alcalde Eduardo Fereye, 10"
    - "Papelería Alhambra" · "Hdor. Manuel Cancela, 6"
- `pipeline/src/topup.ts`:
  - `loadTopUp(json): TopUpPoint[]`
  - `posterImageFromPage(html: string): string | null`: la primera imagen cuyo nombre contiene `RedVenta`.
  - `topUpPosterChanged(html: string, recorded: string): boolean`
- `main.ts` añade `topUpPoints` al dataset.
- `validate.ts`: si hay `topUpPoints`, ≥ 1 punto, cada uno con `name` y `address` no vacíos, y una `zone` válida.
- Comprobación mensual (en el workflow `holidays.yml`, que pasa a llamarse "Comprobaciones mensuales"): descarga la página de puntos de venta. Si `topUpPosterChanged` da true (Comujesa ha subido otro cartel), abre una Issue "Ha cambiado el cartel de puntos de recarga" con el enlace, para que el autor actualice `topup-points.json` y su `posterImage`. Sin duplicados, igual que la de festivos.
- App, `src/lib/topup.ts`: `groupTopUp(points: TopUpPoint[]): { zone: TopUpPoint['zone']; points: TopUpPoint[] }[]`, con las oficinas primero y luego centro, norte, este, oeste y sur, sin zonas vacías.
- Pantalla Recarga:
  - Espacio reservado del mapa.
  - "Dónde recargar la tarjeta Multiviaje, Azul o Mensual".
  - Las secciones por zona con nombre, dirección y nota.
  - Pie: "Según el cartel oficial de Comujesa · revisado el {checked}" y un enlace a la página oficial (`Linking.openURL`).
  - Si los datos no traen `topUpPoints` (copia antigua): "Consulta los puntos de recarga en la web de Comujesa", con el enlace.

- [ ] **Step 1:** Tests:
  - Pipeline: `posterImageFromPage` con un HTML que contiene `csm_RedVenta_6caee5bb75.jpg` → esa ruta. `topUpPosterChanged` → false con la misma ruta y true con otra. `loadTopUp` con el archivo real → 30 puntos, 2 de zona oficina. `validate` rechaza un punto sin dirección.
  - App: `groupTopUp` pone las oficinas primero y quita las zonas vacías. `recarga` con datos de prueba → se ven "Oficina de Atención al Usuario" y el título de una zona. Sin `topUpPoints` → se ve el enlace a la web.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar. Al final, `cd pipeline && npm run build-data` (debe salir con 0) y copiar `pipeline/out/data.json` a `src/data/bundled.json`. Comprobar con node: 18 líneas, `schemaVersion` 1 y 30 `topUpPoints`.
- [ ] **Step 4:** Run `npm test`, `npm run typecheck`, `cd pipeline && npm test && npx tsc -p .`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: puntos de recarga`.

### Task 7: Volver a buscar datos nuevos al regresar a la app

**Files:**
- Modify: `src/data/DataProvider.tsx`
- Test: `src/data/__tests__/DataProviderLoading.test.tsx` (ampliar)

**Interfaces:**
- Cuando `AppState` pasa a `'active'` y `checkedAt` es null o tiene más de 12 h, se lanza `syncData` en segundo plano. Nunca se lanzan dos a la vez: un indicador `syncing` en una ref lo impide. La suscripción se limpia al desmontar.

- [ ] **Step 1:** Tests: con `checkedAt` de hace 13 h, el evento `'active'` lanza una descarga del manifiesto. Con `checkedAt` de hace 1 h, no la lanza. Dos eventos seguidos mientras hay una sincronización en curso lanzan una sola descarga.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): buscar datos nuevos al volver a la app`.
