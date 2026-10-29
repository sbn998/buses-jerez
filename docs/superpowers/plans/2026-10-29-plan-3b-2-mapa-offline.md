# Plan 3b-2: mapa sin conexión, mapa de Recarga, centrar en mí y cruce con OSM

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Desde Opciones se puede descargar el mapa de Jerez (unos 4 MB) para usarlo sin conexión, ver lo que ocupa y borrarlo.
- Recarga muestra sus puntos en el mapa.
- Cerca de mí tiene un botón "Centrar en mí".
- El pipeline avisa cuando una parada oficial está lejos de su gemela en OpenStreetMap.
- El archivo de tipografías pasa de 41 MB a menos de 1 MB.

**Architecture:**
- El mapa sin conexión no usa paquetes de MapLibre. Se descargan con `expo-file-system` tres cosas a `documentDirectory/map/`: el archivo `jerez.pmtiles` (3,5 MB) y las tipografías recortadas.
- Una función pura, `buildLocalStyle(remoteStyle, dir)`, cambia las URLs del estilo por `pmtiles://file://…` y `file://…/fonts/{fontstack}/{range}.pbf`.
- `JerezMap` usa el estilo local si está descargado, y el remoto si no lo está.
- Las coordenadas de los puntos de recarga se calculan una sola vez con un script manual (Nominatim, 1 petición por segundo), las revisa el autor y se guardan en `topup-points.json`.

**Tech Stack:** el de los planes anteriores. `expo-file-system` (API `File`/`Paths`, ya usada en `DataProvider`) y Nominatim (`https://nominatim.openstreetmap.org/search`, User-Agent identificado, como mucho 1 petición por segundo).

**Spec:** `docs/superpowers/specs/2026-10-28-buses-jerez-design.md` (3.2 Recarga, Opciones y Cerca de mí; 4; 4.1).

## Global Constraints
- Coste cero, nada de claves ni información personal en el repo, `.gitignore` de lista blanca, commits con `193912679+sbn998@users.noreply.github.com` y sin líneas de atribución.
- **Explicado para principiantes:** cada archivo nuevo empieza con un comentario en español que dice para qué sirve, y las funciones no triviales llevan un comentario corto.
- Textos en es y en con las mismas claves. "© OpenStreetMap" visible en todo mapa.
- **Nada de información falsa:**
  - un punto de recarga cuya geocodificación no se ha confirmado se marca `approximate` y se dibuja como círculo hueco, con su leyenda;
  - un punto que no se pudo geocodificar no se dibuja, pero sigue en la lista.
- **El mapa nunca bloquea:** una descarga a medias o fallida no rompe el mapa. Se borran los archivos parciales y se sigue usando el mapa remoto.
- No tocar el comportamiento ya revisado de `JerezMap` (vigilante de 8 s, fondo liso, Reintentar) salvo lo que pide cada tarea.
- URLs: `https://sbn998.github.io/buses-jerez/map/jerez.pmtiles`, `…/map/style.json` y `…/map/fonts/<fontstack>/<range>.pbf`.

## Review Focus
1. **Descarga interrumpida** (sin red a mitad, o la app cerrada): no queda un mapa "descargado" corrupto. Solo se marca como descargado cuando están todos los archivos y su tamaño cuadra. Lo prueba la Task 2 (`partial download is cleaned`).
2. **Mapa descargado y luego borrado:** `JerezMap` vuelve al estilo remoto sin reiniciar la app. Lo prueba la Task 2 (`delete switches back to remote`).
3. **Punto de recarga sin coordenadas:** no se dibuja, sigue en la lista y nunca aparece en 0,0. Lo prueba la Task 4.
4. **"Centrar en mí" sin ubicación** (por ejemplo, con el permiso denegado): el botón no se muestra o no hace nada, pero nunca se rompe. Lo prueba la Task 3.
5. **Cruce con OSM:** solo da avisos (warnings), nunca bloquea la publicación. Lo prueba la Task 5.

---

### Task 1: Recortar las tipografías

**Files:** Modify `.github/workflows/map.yml` (paso de tipografías), `pipeline/README.md`.

- [ ] **Step 1:** En el paso que prepara `fonts-src`, quedarse solo con los rangos `0-255.pbf`, `256-511.pbf` y `8192-8447.pbf` de `Noto Sans Regular` y `Noto Sans Bold`, que cubren el latín, los acentos del español y la puntuación. Mantener la comprobación `test -f` de `0-255.pbf` y añadirla para los otros dos rangos. Si `fonts.zip` pesa más de 2 MB, fallar.
- [ ] **Step 2:** Validar con `npx --yes js-yaml .github/workflows/map.yml`. Commit `ci(map): solo los rangos latinos de las tipografías`.

### Task 2: Mapa sin conexión (descarga en Opciones)

**Files:**
- Create: `src/lib/offlineMap.ts`, `src/lib/localStyle.ts`, `src/components/options/OfflineMapSection.tsx`
- Modify: `src/components/map/JerezMap.tsx` (elegir el estilo local o el remoto), `src/app/opciones.tsx` (sustituir el bloque "Disponible pronto"), `src/i18n/es.ts` y `en.ts`
- Test: `src/lib/__tests__/localStyle.test.ts`, `src/lib/__tests__/offlineMap.test.ts`, `src/components/options/__tests__/OfflineMapSection.test.tsx`, y ampliar `src/components/map/__tests__/JerezMap.test.tsx`

**Interfaces:**
- `FONT_FILES = ['Noto Sans Regular/0-255.pbf', 'Noto Sans Regular/256-511.pbf', 'Noto Sans Regular/8192-8447.pbf']`, y los mismos tres para `Noto Sans Bold`.
- `buildLocalStyle(remote: object, dirUri: string): object`. Es una función pura: devuelve una copia del estilo con `sources.openmaptiles.url = 'pmtiles://' + dirUri + '/jerez.pmtiles'` y `glyphs = dirUri + '/fonts/{fontstack}/{range}.pbf'`, y no modifica el objeto que recibe.
- `offlineMap.ts`, con el sistema de archivos inyectable para las pruebas:
  - `getOfflineStatus(): Promise<{ downloaded: boolean; bytes: number }>`. Lee un `manifest.json` local con `{ files: { path, bytes }[] }`, y solo da `downloaded: true` si están todos los archivos y su tamaño coincide.
  - `downloadOfflineMap(onProgress: (done: number, total: number) => void): Promise<void>`. Descarga `style.json`, `jerez.pmtiles` y los 6 archivos de tipografías a una carpeta temporal, escribe el estilo local ya convertido y el manifiesto, y al final cambia el nombre de la carpeta temporal a `map/`, de golpe. Si algo falla, borra la carpeta temporal y relanza el error.
  - `deleteOfflineMap(): Promise<void>`.
  - Un pequeño store de zustand (`useOfflineMap`) con `status` y `refresh()`, para que `JerezMap` se entere de los cambios sin reiniciar la app.
- `JerezMap`: si `useOfflineMap().status.downloaded`, usa `mapStyle` = el estilo local leído del disco; si no, `MAP_STYLE_URL`.
- Opciones muestra:
  - no descargado: "Descargar mapa de Jerez (≈ N MB)", donde N sale de `HEAD` o de un tamaño conocido;
  - descargando: progreso;
  - descargado: "Mapa descargado · N MB · Borrar";
  - error: "No se pudo descargar. Reintentar".

- [ ] **Step 1:** Tests:
  - `buildLocalStyle` cambia las 2 URLs y no modifica la entrada.
  - `partial download is cleaned`: si falla la tercera descarga, la carpeta temporal se borra y el estado sigue en `downloaded: false`.
  - Una descarga completa da `downloaded: true` y los bytes correctos.
  - `delete switches back to remote`: `JerezMap` graba `mapStyle` local cuando está descargado y `MAP_STYLE_URL` después de borrar.
  - La interfaz de Opciones cubre los 4 estados.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `npm test` y `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): mapa de Jerez sin conexión`.

### Task 3: Botón "Centrar en mí" en Cerca de mí

**Files:** Modify `src/components/map/JerezMap.tsx` (prop opcional `recenterKey?: number`, que mueve la cámara a `center`/`bounds` cada vez que cambia, con la ref imperativa de `Camera` de MapLibre v11; comprobar su API en `node_modules`), el mock de MapLibre (grabar las llamadas a la cámara) y `src/app/(tabs)/cerca.tsx` (un botón sobre el mapa, solo si hay `coords`). Añadir claves i18n. Tests en `cerca.test.tsx` y `JerezMap.test.tsx`.

- [ ] **Step 1:** Tests:
  - Al pulsar "Centrar en mí", la cámara del mock recibe un movimiento a la posición del usuario, o a los límites que la incluyen.
  - Sin `coords`, el botón no aparece.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `npm test` y `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): centrar el mapa en mí`.

### Task 4: Puntos de recarga en el mapa

**Files:**
- Create: `pipeline/src/geocodeTopup.ts` (script manual, `npm run geocode-topup`)
- Modify: `src/data/schema.ts` (`TopUpPoint` añade `lat?`, `lon?` y `approximate?`, todos opcionales), `pipeline/topup-points.json` (rellenado por el script), `pipeline/src/validate.ts` (si hay coordenadas, deben caer en la caja de Jerez), `src/app/(tabs)/recarga.tsx` (`JerezMap` con los puntos), `src/data/bundled.json` (regenerado)
- Test: `pipeline/test/geocodeTopup.test.ts` (lógica pura) y ampliar `src/app/__tests__/recarga.test.tsx`

**Interfaces:**
- `geocodeTopup.ts`:
  - Para cada punto que no sea oficina y no tenga coordenadas, consulta Nominatim con `q = '<dirección>, Jerez de la Frontera, España'`, con `format=jsonv2`, `limit=1`, `countrycodes=es`, el User-Agent del proyecto y 1,1 s entre peticiones.
  - Se acepta el resultado solo si cae dentro de la caja de Jerez. Si el resultado es de tipo `house`, `building` o `shop`, `approximate = false`; si no (calle o zona), `approximate = true`.
  - Las 2 oficinas: si hay coordenadas conocidas en OSM, ponerlas con `approximate: false`; si no, dejarlas aproximadas.
  - Escribe el JSON y muestra un resumen (cuántos puntos exactos, aproximados y sin resultado).
  - La parte pura, `pickResult(results, bbox)`, se prueba con resultados de ejemplo.
- Ejecutarlo una vez en la tarea, con red real, unos 40 s. Revisar el resumen. Hacer commit del JSON con las coordenadas.
- Recarga: mapa de 220 px con los puntos que tienen coordenadas (los aproximados, huecos), la leyenda si hace falta, y al tocar un punto se abre su fila en la lista. Los puntos sin coordenadas solo salen en la lista.
- Regenerar `bundled.json`: `cd pipeline && npm run build-data`, copiar `pipeline/out/data.json` y comprobar 18 líneas y 30 puntos.

- [ ] **Step 1:** Tests:
  - `pickResult` rechaza un resultado fuera de Jerez, marca una calle como aproximada y una casa como exacta.
  - `validate` rechaza un punto en 40,-3.
  - Recarga: un punto con coordenadas está en `shape-source-stops`, o en la fuente que use la pantalla; un punto sin coordenadas no lo está, pero se ve en la lista.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Ejecutar el script y regenerar los datos incluidos. Run `npm test`, `npm run typecheck` y `cd pipeline && npm test && npx tsc -p .`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: puntos de recarga en el mapa`.

### Task 5: Cruce de paradas con OpenStreetMap (solo avisos)

**Files:** Create `pipeline/src/osmCrossCheck.ts`. Modify `pipeline/src/main.ts`, que ya descarga las paradas de OSM, para añadir los avisos. Test `pipeline/test/osmCrossCheck.test.ts`.

**Interfaces:** `osmCrossCheck(stops: Record<string, Stop>, osm: OsmStop[], thresholdM = 150): string[]`. Devuelve un aviso por cada parada con `coordSource` `kml` o `name-match` cuya gemela en OSM (mismo `ref`) esté a más de `thresholdM`. Ejemplo: "stop 343: official location is 220 m from OSM ref 343". Las distancias se calculan con la misma fórmula haversine que la app; copiarla en el pipeline con un comentario, porque `src/lib` es código de la app.

- [ ] **Step 1:** Tests: dos paradas a 50 m y 300 m de su gemela → solo 1 aviso. Una sin `ref` en OSM → ningún aviso. Una con `coordSource` `override` → se ignora.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implementar y añadir los avisos en `main.ts`.
- [ ] **Step 4:** Run `cd pipeline && npm test && npx tsc -p .`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(pipeline): avisar si una parada se aleja de OpenStreetMap`.
