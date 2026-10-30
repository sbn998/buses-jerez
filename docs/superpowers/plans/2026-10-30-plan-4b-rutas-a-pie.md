# Plan 4b: rutas a pie por calles reales en Cómo llego

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- En Cómo llego, los metros y minutos andando hasta la parada de subida y desde la de bajada se calculan **por calles reales**, con OpenRouteService.
- Si el servicio no responde, se agota la cuota o no hay respuesta en 4 s, se usa la estimación de siempre (línea recta × 1,3), marcada "aproximada".

**Architecture:**
- **Intermediario:** un Cloudflare Worker (`worker/`, plan gratuito, sin tarjeta) recibe un punto y hasta 10 paradas.
  - Pide a OpenRouteService una matriz de distancias a pie (`/v2/matrix/foot-walking`): una sola petición por lado del viaje.
  - Guarda cada par punto↔parada 30 días en la caché de Cloudflare (Cache API, gratis).
  - La clave de OpenRouteService vive solo como secreto del Worker. Nunca está en el repo ni en la app.
- **App:**
  - `src/lib/walking.ts` llama al Worker.
  - El planificador acepta distancias reales por parada (`walks`) y usa la estimación para las que falten.
  - La pantalla pide las distancias solo al cambiar el origen o el destino (o si te mueves más de 50 m), nunca en cada minuto.
  - Los transbordos (150 m como mucho) siguen estimados.

**Tech Stack:** Cloudflare Workers con TypeScript y `wrangler` (solo como devDependency de `worker/`), vitest para las pruebas del Worker, y la API Matrix de OpenRouteService (perfil `foot-walking`).

**Spec:** `docs/superpowers/specs/2026-10-28-buses-jerez-design.md`: 3.2 Cómo llego ("Tiempo andando por calles reales", "intermediario gratuito", "aproximada" si falla), 4 y 4.1 (OpenRouteService y Cloudflare Workers en la tabla de coste cero).

**Antes de ejecutar (lo hace el autor, unos 10 minutos):**
- cuenta gratuita en openrouteservice.org, con una clave de API;
- cuenta gratuita en dash.cloudflare.com (plan Free, sin dominio).

La clave no se pega en el chat ni en ningún archivo: se escribe solo en el paso de la Task 4.

## Global Constraints
- Coste cero, ninguna tarjeta. Nada de claves ni información personal en el repo. `.gitignore` de lista blanca: hay que añadir `!/worker/`, sin `node_modules/`, `.wrangler/` ni `.dev.vars`. Commits con `193912679+sbn998@users.noreply.github.com` y sin líneas de atribución.
- **Explicado para principiantes:** cada archivo nuevo empieza con un comentario en español que dice para qué sirve, y las funciones no triviales llevan un comentario corto.
- Textos en es y en con las mismas claves.
- **Límites:**
  - como mucho 10 paradas por petición;
  - solo coordenadas dentro de la caja de Jerez `[-6.35, 36.55, -5.85, 36.85]`;
  - cuerpo de 2 KB como mucho;
  - cualquier otra cosa da 400 y no consulta OpenRouteService.
- **Nada de información falsa:** una distancia solo es "real" (`approximate: false`) si viene de OpenRouteService. Toda opción con algún tramo a pie estimado lleva la etiqueta "Distancias aproximadas"; si todos son reales, pone "Distancias a pie por calles".
- **El planificador sigue siendo puro y síncrono.** Las distancias reales llegan como dato (`walks`); el planificador no hace peticiones.
- **Ningún módulo nativo nuevo** en la app.
- **Cuota:** la API Matrix gratuita de OpenRouteService da unas 500 peticiones al día y 40 por minuto; hay que comprobarlo en su panel al crear la cuenta. Cada búsqueda gasta 2 como mucho, y menos con la caché. Si se agota, la app vuelve a "aproximada" sin romperse.
- Sin GitHub Actions para el Worker. Lo publica el autor a mano con `wrangler deploy` (Task 4).

## Review Focus
1. **El Worker cae o tarda:** la app sigue dando resultados con la estimación marcada "aproximada" en 4 s como mucho. Lo prueba la Task 3 (`falls back when walking fails`).
2. **Abuso del Worker** (puntos fuera de Jerez, 500 paradas, JSON roto, GET): responde 400 o 405 sin llamar a OpenRouteService. Lo prueba la Task 1.
3. **OpenRouteService devuelve `null` en un par** (no hay camino a pie): esa parada usa la estimación y no se guarda en caché. Lo prueban la Task 1 y la Task 2.
4. **Cada minuto el reloj vuelve a calcular el plan:** no se repite la petición al Worker. Lo prueba la Task 3 (`does not refetch on minute tick`).
5. **Respuesta vieja tras cambiar de destino:** se descarta. Lo prueba la Task 3.

---

### Task 1: Worker intermediario (código y pruebas, sin publicar)

**Files:**
- Create: `worker/package.json` (scripts `test` = `vitest run` y `deploy` = `wrangler deploy`; devDependencies `wrangler`, `vitest`, `typescript` y `@cloudflare/workers-types`), `worker/tsconfig.json`, `worker/wrangler.toml` (`name = "buses-jerez-walk"`, `main = "src/index.ts"`, `compatibility_date` reciente), `worker/src/index.ts`, `worker/src/walk.ts`, `worker/README.md` (los pasos de la Task 4, en español)
- Modify: `.gitignore` (añadir `!/worker/` y, en la sección de generados, `.wrangler/` y `.dev.vars`)
- Test: `worker/test/walk.test.ts`

**Interfaces:**
- Produces, con contrato HTTP `POST /walk`:
  - petición `{ origin: [lon, lat], points: [lon, lat][], direction: 'from' | 'to' }` (`from`: del origen a cada punto; `to`: de cada punto al origen);
  - respuesta 200 `{ meters: (number | null)[] }`, en el mismo orden que `points`;
  - 400 si la petición no es válida, 405 si el método no es POST, y 502 si OpenRouteService falla (se reenvía su estado en `{ error }`).
- `walk.ts` (puro, probado):
  - `validateRequest(body: unknown): WalkRequest | null`;
  - `cacheKey(direction, origin, point): string`, con las coordenadas redondeadas a 4 decimales (unos 10 m), por ejemplo `https://cache.local/walk/v1/from/-6.1361,36.6866/-6.1100,36.6705`;
  - `buildMatrixBody(req: WalkRequest, missing: number[]): object`, con `locations` = origen + puntos que faltan; `sources` y `destinations` según la dirección; `metrics: ['distance']`;
  - `parseMatrix(json: unknown, count: number): (number | null)[]`, que redondea los metros.
- `index.ts`: `export default { fetch(request, env, ctx) }`, con `env.ORS_API_KEY`. Busca cada par en `caches.default` y llama a `https://api.openrouteservice.org/v2/matrix/foot-walking` solo con los que faltan. Guarda los nuevos con `Cache-Control: max-age=2592000` usando `ctx.waitUntil`; los `null` no se guardan. Para poder probarlo, `handle(request, env, deps: { fetch, cache })`.

- [ ] **Step 1:** Escribir las pruebas, con `fetch` y la caché simulados:
  - `validateRequest` rechaza un punto fuera de Jerez, 11 puntos, una `direction` desconocida y lo que no es objeto.
  - `cacheKey` redondea a 4 decimales.
  - `buildMatrixBody` con `direction: 'to'` pone los puntos en `sources` y el origen en `destinations`.
  - `parseMatrix` mantiene los `null`.
  - `handle`:
    - con todo en caché, no llama a OpenRouteService;
    - con 2 de 3 en caché, pide solo 1 punto y devuelve los 3 en orden;
    - si OpenRouteService da 429, responde 502 y no guarda nada;
    - con GET, responde 405.
- [ ] **Step 2:** Run `cd worker && npm install && npm test`. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `cd worker && npm test && npx tsc --noEmit`. Expected: PASS. Comprobar con `git status` que no aparecen `node_modules/` ni `.wrangler/`.
- [ ] **Step 5:** Commit `feat(worker): intermediario de rutas a pie con caché`.

### Task 2: Distancias reales en el planificador y cliente del Worker

**Files:**
- Modify: `src/lib/planner.ts`, `src/lib/__tests__/planner.test.ts`
- Create: `src/lib/walking.ts`, `src/lib/__tests__/walking.test.ts`

**Interfaces:**
- `WalkEstimate.approximate` pasa de `true` a `boolean`.
- `planTrips(..., options?)` acepta `walks?: { fromOrigin?: Record<string, number>; toDestination?: Record<string, number> }` (metros por código de parada):
  - si hay un valor, ese tramo es `{ meters, minutes: walkingMinutes(meters), approximate: false }`;
  - si falta, se usa `estimateWalk` como hoy.
  - El radio `maxWalkMeters` y la selección de candidatas siguen en línea recta, para que las candidatas no cambien al llegar las distancias reales.
- `candidateStops(data: Dataset, point: LatLon, options?: Partial<typeof PLANNER_DEFAULTS>): Stop[]`: las mismas candidatas que usa `planTrips` por dentro (el código se comparte, no se copia).
- `isApproximate(option: RouteOption): boolean`: `true` si `walkToStop`, `walkFromStop` o `transferWalk` es aproximado.
- `walking.ts`:
  - `WALK_API_URL`: constante con la URL del Worker. Hasta la Task 4 vale `''`, y entonces `fetchWalks` devuelve `null` sin pedir nada.
  - `fetchWalks(origin: LatLon, stops: Stop[], direction: 'from' | 'to', fetchFn = fetch, timeoutMs = 4000): Promise<Record<string, number> | null>`. Devuelve `null` si hay error, se agota el tiempo o el estado no es 2xx. Las paradas con `meters: null` no entran en el resultado.

- [ ] **Step 1:** Escribir las pruebas:
  - Con `walks.fromOrigin = { S1: 420 }`, la opción tiene `walkToStop` = `{ meters: 420, approximate: false }` y la llegada se recalcula con `walkingMinutes(420)`.
  - Sin `walks`, todo sale como antes (las pruebas de antes siguen pasando).
  - `candidateStops` coincide con las paradas que usa `planTrips`.
  - `isApproximate` es `false` solo si todos los tramos son reales.
  - `fetchWalks`: manda el cuerpo esperado y quita los `null`. Con 500 da `null`, con un error lanzado da `null`, al agotar el tiempo da `null` (con temporizadores falsos), y sin URL configurada da `null` sin llamar a `fetch`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `npm test` y `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): el planificador acepta distancias a pie reales`.

### Task 3: Cómo llego usa las distancias reales

**Files:**
- Modify: `src/app/(tabs)/como-llego.tsx`, `src/components/directions/RouteOptionCard.tsx`, `src/i18n/es.ts` y `en.ts`
- Test: ampliar `src/app/__tests__/como-llego.test.tsx` y `src/components/directions/__tests__/RouteOptionCard.test.tsx`

**Interfaces:**
- Consumes: `candidateStops`, `isApproximate` y la opción `walks` (Task 2); `fetchWalks` (Task 2).
- Al tener origen y destino:
  - se hacen en paralelo `fetchWalks(origen, candidateStops(origen), 'from')` y `fetchWalks(destino, candidateStops(destino), 'to')`;
  - el resultado se guarda en estado y se pasa como `walks` a `planTrips`.
  - Mientras llega, se muestran ya los resultados con la estimación. No hay pantalla de espera.
- **Cuándo se vuelve a pedir:** solo si cambia el destino, si cambia el origen elegido, o si el origen es "tu ubicación" y te has movido más de 50 m desde la última petición. El reloj de cada minuto no vuelve a pedir.
- **Respuestas viejas:** una respuesta que llega después de cambiar de destino o de origen se descarta (contador, como `checkId`).
- `RouteOptionCard`: si `isApproximate(option)`, "Distancias aproximadas"; si no, la clave nueva `directions.streetDistances`: "Distancias a pie por calles" en es y "Walking distances along streets" en en.

- [ ] **Step 1:** Escribir las pruebas, con `fetchWalks` simulado:
  - `uses street distances`: con respuesta, la tarjeta dice "Distancias a pie por calles" y muestra los metros reales.
  - `falls back when walking fails`: con `null`, sale "Distancias aproximadas" y siguen las opciones.
  - `does not refetch on minute tick`: al avanzar 1 minuto, `fetchWalks` sigue con 2 llamadas.
  - Cambiar de destino vuelve a pedir, y la respuesta vieja que llega tarde no cambia lo que se ve.
  - Con origen "tu ubicación", un movimiento de 30 m no vuelve a pedir y uno de 80 m sí.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `npm test` y `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): Cómo llego usa distancias a pie por calles`.

### Task 4: Publicar el Worker y conectarlo (con el autor)

Esta tarea crea cosas en la cuenta del autor: **el agente para y pregunta antes de cada paso marcado (autor).**

- [ ] **Step 1 (autor):** en `worker/`, `npx wrangler login`. Se abre el navegador y se acepta.
- [ ] **Step 2 (autor):** `npx wrangler secret put ORS_API_KEY` y pegar la clave **en la terminal**, no en el chat.
- [ ] **Step 3 (autor):** `npx wrangler deploy`. Anotar la URL `https://buses-jerez-walk.<subdominio>.workers.dev`.
- [ ] **Step 4:** Prueba de humo, 1 sola petición: `curl -s -X POST <URL>/walk -H "content-type: application/json" -d '{"origin":[-6.1361,36.6866],"points":[[-6.1340,36.6850]],"direction":"from"}'`. Expected: `{"meters":[N]}` con N entre 150 y 600. Repetirla debe salir de la caché (no gasta cuota).
- [ ] **Step 5:** Poner la URL en `WALK_API_URL` (`src/lib/walking.ts`, con `/walk` al final), con la prueba de que deja de devolver `null` sin llamar. Run `npm test` y `npm run typecheck`. Commit `feat(app): conectar Cómo llego con el intermediario de rutas a pie`.
