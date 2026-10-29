# Plan 4a: Cómo llego (buscar destino, planificar con 1 transbordo y mapa)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En la pestaña Cómo llego se escribe un destino de Jerez ("Luz Shopping"), se elige de una lista, y la app propone opciones en bus (directas o con 1 transbordo) desde tu ubicación o desde otro origen. Cada opción da el tiempo total, los metros andando, las líneas, dónde subir, dónde bajar, el transbordo y la espera, según el horario oficial de hoy. Las opciones se pueden ordenar por Más rápido, Menos andar o Menos transbordos, y la elegida se ve en el mapa.

**Architecture:**
- **Planificador:** `src/lib/planner.ts` es lógica pura, sin red. Usa los viajes reconstruidos (`line.trips[dayType]`) que ya trae `data.json`, así que no inventa horas.
- **Búsqueda de lugares:** `src/lib/placeSearch.ts` usa Photon (`https://photon.komoot.io/api/`, gratis y sin clave). Solo busca al pulsar Buscar y guarda en memoria las búsquedas repetidas.
- **Conexión:** `src/lib/online.ts` comprueba si hay red pidiendo `manifest.json` a nuestro GitHub Pages. No añade módulos nativos, así que no hace falta recompilar la app de desarrollo.
- **Andar:** en este plan, los metros andando son una estimación: la línea recta × 1,3. Todos los resultados llevan la etiqueta "distancias aproximadas", como pide el diseño cuando no hay servicio de rutas.
- **Mapa:** `JerezMap` gana dos capas, `routes` (los tramos en bus, del color de cada línea) y `places` (origen y destino).

**Tech Stack:** el de los planes anteriores. Photon (komoot) para buscar lugares, sin clave.

**Spec:** `docs/superpowers/specs/2026-10-28-buses-jerez-design.md` (1, 2, 3.2 Cómo llego, 4, 4.1, 6). Boceto: `docs/superpowers/specs/2026-10-28-bocetos/como-llego.png`.

**Fuera de este plan (Plan 4b):**
- Las rutas a pie por calles reales: OpenRouteService detrás de un intermediario en Cloudflare Workers. El autor tiene que crear antes 2 cuentas gratuitas (OpenRouteService y Cloudflare), sin tarjeta.
- Hasta entonces, toda distancia andando es aproximada y se dice así. Es el comportamiento de reserva que el diseño ya pide.
- Los viajes que terminan antes de tiempo ("21:38a = retirada en Moreno Mendoza") necesitan el OCR del Plan 5. Hasta entonces, el planificador usa los viajes tal como vienen en `trips`.

## Global Constraints
- Coste cero. Nada de claves ni información personal en el repo. `.gitignore` de lista blanca. Commits con `193912679+sbn998@users.noreply.github.com` y sin líneas de atribución.
- **Explicado para principiantes:** cada archivo nuevo empieza con un comentario en español que dice para qué sirve, y las funciones no triviales llevan un comentario corto.
- Textos en es y en con las mismas claves. "© OpenStreetMap" visible en todo mapa (ya lo pone `JerezMap`).
- **Ningún módulo nativo nuevo** (no se toca `package.json` de la app). Así no hace falta otra development build.
- **Photon, uso respetuoso:**
  - se busca solo al pulsar Buscar o Intro, nunca en cada letra, y con 3 caracteres como mínimo;
  - las búsquedas repetidas salen de una caché en memoria;
  - la petición lleva `User-Agent: buses-jerez-app/1.0 (+https://github.com/sbn998/buses-jerez)`, `limit=8` y `bbox=-6.35,36.55,-5.85,36.85`.
- **Nada de información falsa:**
  - las horas salen solo de `line.trips` del tipo de día de hoy (`dayTypeFor(now, data.holidays)`);
  - no se ofrecen viajes de mañana ni de ayer;
  - los metros andando, que son estimados, llevan siempre la etiqueta "aproximado".
- **Sin conexión, la pantalla entera muestra "Esta función necesita conexión"**, con el botón Reintentar. No da resultados aproximados.
- Como mucho 1 transbordo. Un bus solo sirve en el orden de su recorrido: se sube en el índice `i` de `line.stopCodes` y se baja en el `j`, con `j > i`, dentro de la misma fila de `trips`, con las dos horas puestas y la de bajada igual o posterior a la de subida.

## Review Focus
1. **Origen o destino lejos de toda parada** (más de 800 m): se usan las 3 paradas más cercanas, como en Cerca de mí. Nunca sale "sin opciones" solo por el radio. Lo prueba la Task 1 (`falls back to nearest stops`).
2. **De noche, sin más buses hoy:** sale el mensaje "Hoy ya no quedan buses para este trayecto". No sale una pantalla vacía ni horas de mañana. Lo prueban la Task 1 (`no trips left today`) y la Task 5.
3. **Photon falla, devuelve 0 resultados o responde 429:** se muestra un error claro y la pantalla sigue usable. Sin red, aparece el aviso a pantalla completa. Lo prueban la Task 2 y la Task 4.
4. **Destino muy cerca del origen** (a menos de 400 m en línea recta): sale "Está a N m: mejor ir andando (unos M min)". Si hay opciones en bus, también salen. Lo prueba la Task 5.
5. **Ubicación denegada:** la pantalla no se bloquea; pide elegir el origen escribiéndolo. Lo prueba la Task 4.

---

### Task 1: Planificador (lógica pura)

**Files:**
- Create: `src/lib/planner.ts`
- Test: `src/lib/__tests__/planner.test.ts` (con un `Dataset` pequeño inventado en la propia prueba: 2 o 3 líneas y unas 8 paradas)

**Interfaces:**
- Consumes: `distanceMeters`, `walkingMinutes` (`src/lib/geo.ts`); `dayTypeFor`, `minutesOfDay` (`src/lib/schedule.ts`); los tipos de `src/data/schema.ts`.
- Produces:
  - `type LatLon = { lat: number; lon: number }`
  - `interface WalkEstimate { meters: number; minutes: number; approximate: true }`
  - `estimateWalk(a: LatLon, b: LatLon): WalkEstimate`: los metros son `round(distanceMeters × detourFactor)` y los minutos `walkingMinutes(meters)`.
  - `interface BusLeg { line: Line; from: Stop; to: Stop; fromIndex: number; toIndex: number; departure: TimeOfDay; arrival: TimeOfDay }`
  - `interface RouteOption`, con estos campos:
    - `id: string` (por ejemplo `"4:343>12|18:12>55"`);
    - `legs: BusLeg[]` (1 o 2 tramos);
    - `walkToStop: WalkEstimate`, `transferWalk: WalkEstimate | null`, `walkFromStop: WalkEstimate`;
    - `firstWaitMinutes: number`, `transferWaitMinutes: number | null`;
    - `arrivalMinutes: number` (minutos desde la medianoche al llegar al destino);
    - `totalMinutes: number` (de ahora a la llegada);
    - `walkMeters: number` (suma de los tres tramos a pie).
  - `type SortMode = 'fastest' | 'leastWalking' | 'fewestTransfers'`
  - `PLANNER_DEFAULTS = { maxWalkMeters: 800, fallbackStops: 3, maxStopsPerEnd: 8, transferRadiusMeters: 150, minTransferMinutes: 1, maxTransferWaitMinutes: 40, maxResults: 6, detourFactor: 1.3 }`
  - `planTrips(data: Dataset, from: LatLon, to: LatLon, now: Date, options?: Partial<typeof PLANNER_DEFAULTS>): RouteOption[]`. Devuelve las opciones sin un orden concreto. Están deduplicadas: como mucho una por combinación de líneas, la de llegada más temprana. Son `maxResults` como mucho, eligiendo las de llegada más temprana.
  - `sortOptions(options: RouteOption[], mode: SortMode): RouteOption[]`. Hace una copia ordenada:
    - `fastest`: por `arrivalMinutes`, y a igualdad por `walkMeters`;
    - `leastWalking`: por `walkMeters`, y luego por `arrivalMinutes`;
    - `fewestTransfers`: por `legs.length`, y luego por `arrivalMinutes`.
  - `legCoords(leg: BusLeg, data: Dataset): [number, number][]`: las coordenadas `[lon, lat]` de las paradas de `fromIndex` a `toIndex`, ambas incluidas. Es el trazado que dibuja el mapa.

**Algoritmo** (lo que el nombre y las pruebas no fijan):
- **Paradas candidatas a cada lado:**
  - las paradas de alguna línea a ≤ `maxWalkMeters` en línea recta, las `maxStopsPerEnd` más cercanas;
  - si no hay ninguna, las `fallbackStops` más cercanas.
- **Hora mínima de subida:** `nowMinutes + walkToStop.minutes`, donde `nowMinutes` son los minutos desde la medianoche de `now`.
- **Tramo directo:**
  - para cada línea, cada parada de subida (índice `i`) y cada parada de bajada (índice `j > i`), se elige la fila de `trips[dayType]` con `row[i]` no nulo y ≥ la hora mínima, `row[j]` no nulo y ≥ `row[i]`, y la menor `row[j]`;
  - la llegada es `row[j] + walkFromStop.minutes`.
- **1 transbordo:**
  - la línea A va de la subida `b` a una parada `t` (índice posterior, en la misma fila);
  - la línea B (distinta de A) sale de una parada `t'`, que es `t` o otra a ≤ `transferRadiusMeters`, y llega a la bajada `a`;
  - la salida de B tiene que ser ≥ llegada a `t` + `transferWalk.minutes` + `minTransferMinutes`, con una espera ≤ `maxTransferWaitMinutes`;
  - para ir rápido, se prepara un índice `stopCode → [{ line, index }]`.

- [ ] **Step 1:** Escribir las pruebas en `planner.test.ts`:
  - `direct trip uses first bus after walking`. A las 10:00, con 4 min andando hasta la parada, una línea que pasa a las 10:02 y a las 10:10 → se toma la de las 10:10, con `firstWaitMinutes` 6.
  - `never rides backwards`. El origen está junto a la última parada y el destino junto a la primera de una línea de un solo sentido → `[]`.
  - `skips trips that start mid-route`. Si una fila tiene `null` en la parada de subida, no se usa.
  - `one transfer with minimum margin`. A llega a T a las 10:20 y B sale de T a las 10:20 y a las 10:30 → se toma la de las 10:30, con `transferWaitMinutes` 10 y `legs.length` 2.
  - `transfer to a nearby stop within 150 m`. El transbordo funciona entre dos paradas a 100 m. A 300 m no hay opción.
  - `no trips left today`. A las 23:59 → `[]`.
  - `uses holiday day type`. Un domingo usa `trips.fes`, aunque `trips.lab` tenga horas antes.
  - `falls back to nearest stops`. Con el origen a 2 km de toda parada, sigue habiendo una opción.
  - `dedupes per line combination`. Dos paradas de subida de la misma línea dan una sola opción.
  - `sortOptions` ordena bien en los 3 modos.
  - `estimateWalk` da 130 m para 100 m en línea recta, y `minutes` = `walkingMinutes(130)`.
  - `legCoords` devuelve `[lon, lat]` en orden.
- [ ] **Step 2:** Run `npx jest src/lib/__tests__/planner.test.ts`. Expected: FAIL (el módulo no existe).
- [ ] **Step 3:** Implementar `planner.ts` con las interfaces y el algoritmo de arriba.
- [ ] **Step 4:** Run `npx jest src/lib/__tests__/planner.test.ts` y `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): planificador de Cómo llego`.

### Task 2: Buscar lugares y comprobar la conexión

**Files:**
- Create: `src/lib/placeSearch.ts`, `src/lib/online.ts`
- Test: `src/lib/__tests__/placeSearch.test.ts`, `src/lib/__tests__/online.test.ts`

**Interfaces:**
- Consumes: `JEREZ_BOUNDS` (`src/lib/mapLayers.ts`), `BASE_URL` (`src/lib/dataSync.ts`).
- Produces:
  - `interface Place { id: string; name: string; detail: string; lat: number; lon: number }`. `detail` es la calle y el número, o el barrio, para distinguir lugares con el mismo nombre.
  - `PHOTON_URL = 'https://photon.komoot.io/api/'`, `APP_USER_AGENT = 'buses-jerez-app/1.0 (+https://github.com/sbn998/buses-jerez)'`.
  - `buildSearchUrl(query: string): string`, con `q`, `limit=8` y `bbox=-6.35,36.55,-5.85,36.85`.
  - `parsePhoton(json: unknown): Place[]`. Toma las features `Point` de la respuesta y:
    - descarta las que quedan fuera de `JEREZ_BOUNDS` o no tienen nombre ni calle;
    - les da un `id` estable (`osm_type` + `osm_id`);
    - quita los repetidos con el mismo `name` y `detail`.
  - `class SearchError extends Error { kind: 'offline' | 'busy' | 'failed' }`. El error de red da `offline`, la respuesta 429 da `busy` y cualquier otro estado distinto de 2xx, o un JSON roto, da `failed`.
  - `searchPlaces(query: string, fetchFn: typeof fetch = fetch): Promise<Place[]>`:
    - recorta la consulta, y con menos de 3 caracteres devuelve `[]` sin pedir nada;
    - guarda en caché por consulta, en minúsculas;
    - manda el `User-Agent`.
  - `clearSearchCache(): void`, para las pruebas.
  - `isOnline(fetchFn: typeof fetch = fetch, timeoutMs = 5000): Promise<boolean>`. Hace `HEAD` a `BASE_URL + 'manifest.json'` con `cache: 'no-store'`. Si la respuesta es correcta, `true`. Si hay error, tiempo agotado o un estado que no es 2xx, `false`.

- [ ] **Step 1:** Escribir las pruebas, con un `fetch` falso:
  - La URL lleva `bbox` y `limit=8`.
  - `parsePhoton`, con una respuesta de ejemplo de 3 features (una fuera de Jerez y dos repetidas), devuelve 1 lugar.
  - `searchPlaces('ab')` no llama a `fetch`.
  - La misma búsqueda dos veces, "Luz Shopping" y "luz shopping ", llama a `fetch` una sola vez.
  - Un `TypeError` de red da `SearchError('offline')`, el estado 429 da `'busy'` y el 500 da `'failed'`.
  - `isOnline`: con 200 da `true`, con un error lanzado da `false`, y si no responde antes de `timeoutMs` da `false` (con temporizadores falsos).
- [ ] **Step 2:** Run las dos pruebas. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run las dos pruebas y `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): buscar lugares con Photon y comprobar la conexión`.

### Task 3: Capas de ruta y de lugares en el mapa

**Files:**
- Modify: `src/lib/mapLayers.ts`, `src/components/map/JerezMap.tsx`
- Test: `src/lib/__tests__/mapLayers.test.ts` (o el archivo de pruebas de `mapLayers` que ya exista) y `src/components/map/__tests__/JerezMap.test.tsx`

**Interfaces:**
- Produces:
  - `routesToGeoJSON(routes: { coords: [number, number][]; colour: string }[]): FeatureCollection<LineString>`, con la propiedad `colour`.
  - `placesToGeoJSON(places: { lat: number; lon: number; kind: 'origin' | 'destination' }[]): FeatureCollection<Point>`, con la propiedad `kind` y las coordenadas en `[lon, lat]`.
  - `JerezMap` acepta dos props opcionales:
    - `routes?`, del mismo tipo de entrada: fuente `routes`, capa `routes-line`, `line-width` 5, color `['get','colour']`, dibujada debajo de las paradas;
    - `places?`: fuente `places`, capa `places-circle`, radio 8, color `#dc2626` para el destino y `#2563eb` para el origen, y borde blanco de 3 px.
  - Sin estas props, `JerezMap` se comporta como hoy. No cambia el vigilante de 8 s, el fondo liso, Reintentar, el estilo local ni `recenterKey`.

- [ ] **Step 1:** Escribir las pruebas:
  - `routesToGeoJSON` y `placesToGeoJSON` ponen `[lon, lat]` y sus propiedades.
  - `JerezMap` con `routes` y `places` registra las fuentes `routes` y `places` en el mock, con esos datos.
  - Sin estas props, no registra esas fuentes.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `npm test` y `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): capas de ruta y de lugares en el mapa`.

### Task 4: Pantalla Cómo llego: conexión, origen y búsqueda de destino

**Files:**
- Modify: `src/app/(tabs)/como-llego.tsx` (sustituye a `ComingSoon`), `src/i18n/es.ts` y `en.ts` (bloque `directions`)
- Create: `src/components/directions/PlaceSearch.tsx` (campo, botón Buscar, lista de lugares y errores), `src/components/directions/OfflineNotice.tsx`
- Test: `src/app/__tests__/como-llego.test.tsx`, `src/components/directions/__tests__/PlaceSearch.test.tsx`

**Interfaces:**
- Consumes: `searchPlaces`, `SearchError`, `isOnline` (Task 2); `useLocation` (`src/hooks/use-location.ts`).
- Produces:
  - `PlaceSearch` con las props `{ placeholder: string; onPick: (p: Place) => void; search?: typeof searchPlaces }`. Busca al pulsar Buscar o Intro.
  - Estado de la pantalla:
    - `connection: 'checking' | 'online' | 'offline'`. Se comprueba al abrir, al volver a primer plano (`AppState` pasa a `active`) y al pulsar Reintentar. Una búsqueda que falla con `offline` también lo pasa a `'offline'`.
    - `origin`: `{ kind: 'me' }` o `{ kind: 'place'; place: Place }`.
    - `destination: Place | null`.
- Textos de la pantalla, siguiendo el boceto:
  - cabecera: "¿A dónde vas?" y "Escribe un lugar o una calle";
  - "Desde: tu ubicación · Cambiar" (o el nombre del lugar elegido);
  - con la ubicación en `denied`, `blocked` o `unavailable`, y sin origen elegido: "Elige desde dónde sales", con su propio `PlaceSearch`;
  - errores: `busy` → "La búsqueda está saturada, prueba en un rato"; `failed` → "No se pudo buscar. Reintentar"; 0 resultados → "No hemos encontrado ese sitio en Jerez".
  - sin conexión: `OfflineNotice` ocupa la pantalla entera con "Esta función necesita conexión" y Reintentar.

- [ ] **Step 1:** Escribir las pruebas, con `isOnline`, `searchPlaces` y `useLocation` simulados:
  - Sin conexión, sale el aviso a pantalla completa y no el buscador. Reintentar con conexión muestra el buscador.
  - Al escribir "Luz" y pulsar Buscar, sale la lista. Al tocar un lugar, queda como destino.
  - Escribir sin pulsar Buscar no llama a `searchPlaces`.
  - Los errores `busy`, `failed` y 0 resultados muestran su texto. `offline` pasa al aviso.
  - Con la ubicación denegada, sale "Elige desde dónde sales". Al elegir un origen, se puede buscar el destino.
  - "Cambiar" el origen a un lugar lo muestra en "Desde: …".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar. Añadir las claves i18n en es y en.
- [ ] **Step 4:** Run `npm test` y `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): Cómo llego busca el destino y el origen`.

### Task 5: Resultados, orden y mapa en Cómo llego

**Files:**
- Modify: `src/app/(tabs)/como-llego.tsx`, `src/i18n/es.ts` y `en.ts`
- Create: `src/components/directions/RouteOptionCard.tsx`, `src/components/directions/SortSelector.tsx`
- Test: ampliar `src/app/__tests__/como-llego.test.tsx`, y `src/components/directions/__tests__/RouteOptionCard.test.tsx`

**Interfaces:**
- Consumes: `planTrips`, `sortOptions`, `legCoords`, `estimateWalk`, `SortMode`, `RouteOption` (Task 1); las props `routes` y `places` de `JerezMap` (Task 3); `useNow`, `useData`.
- Produces:
  - Con origen y destino, `planTrips(data, origen, destino, now)`, memorizado con `useMemo`.
  - `SortSelector`: Más rápido, Menos andar y Menos transbordos. Por defecto, Más rápido.
  - Lista de `RouteOptionCard`. Cada tarjeta muestra:
    - las insignias de las líneas, con su color (`textColourFor`);
    - "N min · M m andando · directo / 1 transbordo";
    - "Súbete en <parada> a las HH:MM (a X m)";
    - si hay transbordo, "Transbordo en <parada>: espera N min";
    - "Bájate en <parada> a las HH:MM (a Y m del destino)";
    - la etiqueta "Distancias aproximadas".
  - Al tocar una tarjeta, queda seleccionada. Por defecto se selecciona la primera.
  - Mapa (`JerezMap`, alto 220):
    - `places`: el origen y el destino;
    - `routes`: los tramos de la opción elegida (`legCoords` + color de la línea);
    - `stops`: las paradas de subida, transbordo y bajada;
    - `bounds`: los que encierran todo.
  - Mensajes:
    - sin opciones → "Hoy ya no quedan buses para este trayecto";
    - con el destino a menos de 400 m en línea recta → "Está a N m: mejor ir andando (unos M min)", encima de la lista (los metros salen de `estimateWalk`).

- [ ] **Step 1:** Escribir las pruebas, con un `Dataset` pequeño y la hora fija:
  - Con origen y destino, sale una tarjeta con "Súbete en", "Bájate en" y "Distancias aproximadas".
  - Cambiar a Menos andar reordena las tarjetas.
  - El mapa recibe `places` con 2 puntos y `routes` con el color de la línea.
  - Tocar la segunda tarjeta cambia `routes`.
  - A las 23:59 sale el mensaje de que no quedan buses.
  - Con el destino a 200 m sale "mejor ir andando".
  - `RouteOptionCard` con un transbordo muestra "Transbordo en … espera 10 min".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `npm test` y `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): opciones de ruta ordenables y en el mapa`.
