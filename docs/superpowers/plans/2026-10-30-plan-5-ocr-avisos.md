# Plan 5: OCR de los PDF de horarios y avisos al abrir la app

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- El proceso diario lee con OCR los PDF oficiales de Comujesa. Saca dos cosas:
  - las horas marcadas con letra ("21:38a") y su leyenda ("a: Retirada en Moreno Mendoza");
  - las fechas de validez del horario.
- Las comprueba contra los datos del buscador y las publica.
- La app las usa así:
  - **Horarios** marca esas horas ("solo hasta Moreno Mendoza" o la nota oficial);
  - **Cómo llego** no ofrece esos viajes más allá de donde terminan;
  - **al abrirla**, avisa 5 días antes de un cambio de horario, avisa si el horario publicado ya caducó y muestra los avisos puntuales que escriba el autor. Cada aviso tiene un botón "No volver a mostrar".

**Architecture:**
- **Pipeline** (`pipeline/src/pdf/`):
  1. Descubre los PDF en la página "Información útil" de Comujesa.
  2. Con una petición HEAD comprueba si han cambiado (`Last-Modified` + `Content-Length`) frente al `ocr.json` publicado el día anterior.
  3. Solo descarga y lee con OCR los que han cambiado: saca la imagen JPEG del PDF, la amplía ×3 con `sharp` y la lee con `tesseract.js`.
  4. El análisis de las palabras leídas es una función pura, probada con la salida real del OCR guardada como fixture.
  5. Un archivo manual permite al autor desbloquear un PDF que el OCR no lea bien.
- **App:**
  - campos nuevos opcionales en `Dataset` y `Line` (los datos antiguos siguen valiendo);
  - marcas en Horarios;
  - un componente de avisos que sale al abrir la app;
  - un store persistente con los avisos descartados.

**Tech Stack:** `tesseract.js` 6 (idioma `spa`), `sharp` 0.34 (solo en `pipeline/`, nunca en la app), vitest, Jest y @testing-library/react-native, zustand con `persist` y AsyncStorage.

**Spec:** `docs/superpowers/specs/2026-10-28-buses-jerez-design.md`. Secciones que aplica:
- 3.6 "Viajes que no completan el recorrido (decisión del autor: opción OCR)";
- 3.3 Avisos;
- 3.2 Horarios;
- 4.1 (OCR gratis en Actions).

**Investigación hecha al escribir el plan (2026-10-30), que el implementador no tiene que repetir:**
- Los 57 PDF (`LINEA_<n>_{LAB,SAB,FES}.pdf`, más `LINEA_15_NJ_*`) están enlazados en `https://www.comujesa.es/autobuses-urbanos/inf-util` bajo `/fileadmin/Documentos/Autobuses_Urbanos/horario_invierno/`.
  - La carpeta cambiará en verano, así que las URL se descubren y nunca se escriben a mano.
  - Los dos PDF de la línea 15 (`LINEA_15_*` y `LINEA_15_NJ_*`) son de la línea `"15"`.
- Cada PDF tiene 1 página con 1 sola imagen JPEG (`/DCTDecode`). Basta con copiar los bytes del stream: no hace falta convertir el PDF a imagen.
- Los PDF son muy distintos:
  - el de la línea 1 laborable mide 5125×3465 y tiene 2 tablas (ida y vuelta);
  - el de la línea 15 NJ laborable mide 4811×712, con 45 columnas y letra diminuta.
- Resultados del OCR con `tesseract.js` (`spa`, modo `SPARSE_TEXT`):
  - **sin ampliar:** en la línea 15 NJ se pierden la mayoría de las horas marcadas;
  - **ampliando ×3** en escala de grises y normalizada: salen casi todas, en unos 20 s por PDF;
  - **ruido típico:** `21:39%a`, `17:52cC`, `7:55C` (es 17:55c), `24:12.`;
  - las letras de la leyenda (`a:`) a veces se pierden, pero el texto sí sale.
- No todas las letras significan "se retira":
  - en la línea 15 NJ, `a` = "Paso por Parque Tecnológico", `b` = "Retirada en Nva. Jarilla" y `c` = "Retirada en Angustias";
  - en la línea 1, `a` = "Retirada en Moreno Mendoza" y `b` = "Retirada en Plaza Esteve".
- **La cabecera** dice "Horarios válidos desde 07/09/2026 al 27/06/2027". La página `inf-util` dice "Horarios Invierno 2026/27 (A partir del Lunes 7 de Septiembre 2026)".
- **Los viajes reconstruidos** (`trips`) ya terminan bien en la línea 1: el de las 21:38 acaba en Solidaridad 21:56. Aun así, en el resto hay ruido: 537 viajes acaban antes de la última parada, muchos son de una sola hora. Por eso no se puede deducir "se retira" de los viajes: hace falta el OCR, como decidió el autor.
- **Cabeceras HTTP:** el servidor de los PDF da `Last-Modified` y `Content-Length`, sin `ETag`.

## Global Constraints
- **Coste cero.** Nada de claves ni datos personales en el repo. `.gitignore` es de lista blanca: hay que añadir los archivos nuevos de `pipeline/` (`ocr-manual.json`, `notices.json` y `test/fixtures/ocr/`) si no entran ya por `!/pipeline/`.
- Commits con `193912679+sbn998@users.noreply.github.com`, sin líneas de atribución.
- **Explicado para principiantes:**
  - cada archivo nuevo empieza con un comentario en español que dice para qué sirve;
  - las funciones no triviales llevan un comentario corto;
  - `pipeline/README.md` explica el OCR, el archivo manual y `notices.json`.
- Textos en es y en con las mismas claves. Los nombres de paradas y las notas oficiales de Comujesa no se traducen: en inglés se muestran tal cual.
- **Peticiones a Comujesa** como en el Plan 1:
  - secuenciales, con 250 ms de pausa entre una y otra;
  - User-Agent `buses-jerez-data/1.0 (+https://github.com/sbn998/buses-jerez)`;
  - el cliente de `pipeline/src/http.ts`, con sus reintentos.
- **Nada de información falsa.** Una hora solo se marca si el OCR la leyó y esa hora existe en el buscador para esa línea, parada y tipo de día. Ante la duda no se marca nada y se deja la hora como estaba.
- **Si un PDF que ha cambiado no se puede validar, no se publica nada** (el proceso sale con código 1, como en el Plan 1). Hay dos salidas:
  - que el PDF vuelva a cambiar;
  - que el autor escriba el resultado a mano en `pipeline/ocr-manual.json`.
- `schemaVersion` sigue en 1: todos los campos nuevos son opcionales.
- La app no gana ningún módulo nativo. `sharp` y `tesseract.js` solo están en `pipeline/package.json`.
- Finales de línea: los archivos nuevos van en LF. Cada archivo existente conserva el suyo (algunos, como `schema.ts`, `validate.ts`, `main.ts` y `planner.ts`, son CRLF).

## Review Focus
1. **El OCR lee mal una hora marcada** (`7:55C` en vez de `17:55c`). Se corrige solo si la versión corregida existe en el buscador. Si no, cuenta como ilegible y bloquea ese PDF. Nunca debe marcar una hora que no existe. Lo prueba la Task 3 (`normalizes noisy marked times`, `rejects marked time missing from buscador`).
2. **Los PDF cambian de carpeta** (`horario_verano`) o la página `inf-util` cambia y no se encuentra ningún PDF. Si se esperaban 57 y salen menos de 54, el proceso falla con un mensaje claro y no publica. Lo prueba la Task 1 (`fails when too few PDFs are found`).
3. **El horario publicado caducó** (hoy es posterior a `validTo`) y Comujesa aún no ha subido el nuevo. La app avisa de que los horarios pueden no estar al día y no oculta nada. Lo prueba la Task 6 (`warns when period expired`).
4. **Comujesa no responde al HEAD de algunos PDF** un día. Se reutiliza el resultado anterior de esos PDF, con un aviso. Si no hay resultado anterior, se bloquea. Lo prueba la Task 4 (`reuses cached result when HEAD fails`).
5. **La app con datos antiguos** (sin `notes`, `period` ni `notices`). Horarios, Cómo llego y el arranque funcionan como hoy y no sale ningún aviso. Lo prueban las Tasks 5 y 6 (`works without notes`, `shows nothing without period or notices`).

---

### Task 1: Descubrir los PDF y sacar su imagen

**Files:**
- Create:
  - `pipeline/src/pdf/sources.ts`;
  - `pipeline/src/pdf/extractJpeg.ts`;
  - `pipeline/test/pdf.test.ts`;
  - `pipeline/test/fixtures/inf-util.html`: copia real de la página, recortada si hace falta, pero con los 57 enlaces y la frase "Horarios Invierno 2026/27 (A partir del Lunes 7 de Septiembre 2026)".
- Modify: `pipeline/src/comujesa/endpoints.ts` (añadir `INFO_URL = 'https://www.comujesa.es/autobuses-urbanos/inf-util'`)

**Interfaces:**
- Produces:
  - `interface PdfSource { file: string; url: string; lineId: string; dayType: DayType }`. `file` es, por ejemplo, `"LINEA_15_NJ_LAB.pdf"`. `lineId` es `"15"` también para `_NJ_`. Los sufijos `LAB`/`SAB`/`FES` pasan a `lab`/`sab`/`fes`.
  - `parsePdfSources(html: string, baseUrl: string): PdfSource[]`: enlaces únicos `LINEA_<n>[_NJ]_{LAB,SAB,FES}.pdf`, con URL absoluta.
  - `MIN_PDF_SOURCES = 54`.
  - `parseStartDate(html: string): string | null`: la fecha "A partir del … 7 de Septiembre 2026" pasada a `"2026-09-07"`. Admite los meses en español con o sin tilde y en cualquier combinación de mayúsculas.
  - `extractJpeg(pdf: Uint8Array): Uint8Array`: los bytes del primer stream que empieza por `FF D8`. Si no hay ninguno, lanza `Error('PDF sin imagen JPEG')`.

- [ ] **Step 1:** Pruebas:
  - `parsePdfSources(fixture)` devuelve 57 fuentes. `LINEA_15_NJ_LAB.pdf` da `{ lineId: '15', dayType: 'lab' }` y su URL empieza por `https://www.comujesa.es/fileadmin/`.
  - **`fails when too few PDFs are found`:** con un HTML de 10 enlaces, `parsePdfSources(...).length < MIN_PDF_SOURCES`. Es la regla que usará la Task 4 para fallar.
  - `parseStartDate(fixture) === '2026-09-07'`, y `null` si no aparece la frase.
  - `extractJpeg` con un PDF sintético (cabecera, un stream `FF D8 … FF D9` y `endstream`) devuelve justo esos bytes, y con un PDF sin JPEG lanza el error.
- [ ] **Step 2:** Run `cd pipeline && npx vitest run test/pdf.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implementar. Para los enlaces usar cheerio, como el resto del pipeline. Para la imagen basta buscar en los bytes; no hace falta ninguna librería de PDF.
- [ ] **Step 4:** Run `cd pipeline && npm test && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(pipeline): descubrir los PDF de horarios y sacar su imagen`.

### Task 2: Lector OCR y fixtures reales

**Files:**
- Create:
  - `pipeline/src/pdf/ocr.ts`;
  - `pipeline/src/pdf/makeOcrFixture.ts` (script `npm run ocr-fixture -- <url-del-pdf> <nombre>`);
  - `pipeline/test/fixtures/ocr/LINEA_1_LAB.json` y `pipeline/test/fixtures/ocr/LINEA_15_NJ_LAB.json`, generados con el script a partir de los PDF reales;
  - `pipeline/test/ocr.smoke.test.ts`.
- Modify: `pipeline/package.json` (dependencias `tesseract.js@^6` y `sharp@^0.34`, y el script `ocr-fixture`)

**Interfaces:**
- Produces:
  - `interface OcrWord { text: string; x0: number; y0: number; x1: number; y1: number; confidence: number }`, en píxeles de la imagen ampliada;
  - `interface OcrPage { width: number; height: number; words: OcrWord[] }`;
  - `ocrImage(jpeg: Uint8Array): Promise<OcrPage>`:
    - con `sharp`: `resize(width × 3)`, `grayscale()`, `normalise()` y salida PNG;
    - con `tesseract.js`: `createWorker('spa')`, `tessedit_pageseg_mode = PSM.SPARSE_TEXT` y las palabras sacadas de `blocks`;
    - el worker se reutiliza entre PDF con `createOcr(): Promise<{ read(jpeg): Promise<OcrPage>; close(): Promise<void> }>`.
- Los fixtures son la salida real de `OcrPage` guardada como JSON. Así las pruebas de la Task 3 no ejecutan el OCR.

- [ ] **Step 1:** Escribir `ocr.smoke.test.ts`: solo se ejecuta con `OCR_SMOKE=1` (`describe.skipIf(!process.env.OCR_SMOKE)`). Lee una imagen JPEG pequeña generada en la propia prueba con `sharp` (texto "21:38a" en un SVG) y espera una palabra que contenga `21:38`.
- [ ] **Step 2:** Implementar `ocr.ts` y el script. Generar los dos fixtures desde `https://www.comujesa.es/fileadmin/Documentos/Autobuses_Urbanos/horario_invierno/LINEA_1_LAB.pdf` y `…/LINEA_15_NJ_LAB.pdf`.
- [ ] **Step 3:** Run `cd pipeline && OCR_SMOKE=1 npx vitest run test/ocr.smoke.test.ts && npm test && npx tsc --noEmit`. Expected: PASS, y en el fixture de la línea 1 aparecen palabras que empiezan por `21:38`.
- [ ] **Step 4:** Commit `feat(pipeline): lector OCR de los PDF con fixtures reales`.

### Task 3: Analizar lo leído (función pura)

**Files:**
- Create: `pipeline/src/pdf/parsePage.ts`, `pipeline/test/parsePage.test.ts`

**Interfaces:**
- Consumes: `OcrPage` (Task 2).
- Produces:
  - `interface LegendEntry { mark: string; text: string }`: `mark` en minúscula; `text` tal cual, sin espacios sobrantes.
  - `interface MarkedTime { stopCode: string; time: TimeOfDay; mark: string }`: `time` en formato `"HH:MM"`.
  - `interface ParsedPdf { validFrom: string | null; validTo: string | null; periodName: string | null; legend: LegendEntry[]; marks: MarkedTime[]; unreadable: string[] }`:
    - `validFrom` y `validTo` en formato `AAAA-MM-DD`;
    - `periodName` es, por ejemplo, `"Invierno 2026/2027"`.
  - `parsePage(page: OcrPage, known: Record<string, TimeOfDay[]>): ParsedPdf`. `known` son las horas del buscador para esa línea y ese tipo de día, por código de parada.
- **Algoritmo** (lo que la prueba no decide):
  1. **Columnas:** las palabras de 1 a 3 cifras que son códigos de parada de `known` y están en la franja superior de cada tabla (la fila "CÓDIGO PARADA", por encima de la primera hora) dan el centro x de cada columna. Cada hora marcada se asigna a la columna con el centro más cercano.
  2. **Hora marcada:**
     - se toma la palabra, se quitan los caracteres que no sean `[0-9:.a-zA-Z]` y se pasa a minúscula;
     - tiene que encajar con `^(\d{1,2})[:.](\d{2})([a-z])[a-z]?$`;
     - se normaliza a `HH:MM`;
     - si esa hora no está en `known[code]` y la hora tiene 1 cifra, se prueba con `1` delante (`7:55` pasa a `17:55`);
     - si aun así no está, el texto original va a `unreadable`.
  3. **Leyenda:**
     - las líneas de texto por debajo de la palabra `OBSERVACIONES` y a su altura o más abajo;
     - cada entrada es `<letra>[:.]? <texto>`;
     - si una letra se perdió, se asignan por orden alfabético las letras usadas en `marks`, solo si hay tantas entradas como letras usadas;
     - si no, la letra que falte va a `unreadable` como `legend:<letra>`.
  4. **Validez:** la expresión `/v[aá]lidos desde (\d{2})\/(\d{2})\/(\d{4}) al (\d{2})\/(\d{2})\/(\d{4})/i` sobre el texto de la cabecera unido. `periodName` sale de `/(Invierno|Verano)\s+\d{4}\/\d{4}/i`.

- [ ] **Step 1:** Pruebas con los fixtures reales. El `known` de cada fixture se saca de `src/data/bundled.json` para la línea y el tipo de día.
  - `LINEA_1_LAB`:
    - `validFrom: '2026-09-07'`, `validTo: '2027-06-27'` y `periodName: 'Invierno 2026/2027'`;
    - en la leyenda, `a: 'Retirada en Moreno Mendoza'` y `b: 'Retirada en Plaza Esteve'`;
    - en `marks`, `{stopCode:'343', time:'21:38', mark:'a'}`, `{stopCode:'418', time:'21:56', mark:'a'}`, `{stopCode:'449', time:'14:03', mark:'b'}` y `{stopCode:'277', time:'14:18', mark:'b'}`;
    - 12 marcas `a` y 6 marcas `b`;
    - `unreadable` vacío.
  - `LINEA_15_NJ_LAB`:
    - en la leyenda, `a: 'Paso por Parque Tecnológico'`, `b: 'Retirada en Nva. Jarilla'` y `c: 'Retirada en Angustias'`;
    - al menos 80 marcas;
    - todas las marcas existen en `known`.
  - `normalizes noisy marked times`: con una página sintética, `"7:55C"` en una columna cuyo `known` tiene `17:55` da `17:55 c`, y `"21:39%a"` da `21:39 a`.
  - `rejects marked time missing from buscador`: `"9:99a"` acaba en `unreadable` y no en `marks`.
- [ ] **Step 2:** Run `cd pipeline && npx vitest run test/parsePage.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `cd pipeline && npm test && npx tsc --noEmit`. Expected: PASS. Si con el fixture real de la línea 15 NJ no se llega a 80 marcas válidas, se ajusta el análisis, no la prueba.
- [ ] **Step 5:** Commit `feat(pipeline): leer horas marcadas, leyenda y fechas de validez`.

### Task 4: Notas de viaje, caché del OCR y publicación

**Files:**
- Create:
  - `pipeline/src/pdf/notes.ts`;
  - `pipeline/src/pdf/ocrCache.ts`;
  - `pipeline/ocr-manual.json` (`{}` con un comentario en el README);
  - `pipeline/notices.json` (`[]`);
  - `pipeline/test/notes.test.ts` y `pipeline/test/ocrCache.test.ts`.
- Modify:
  - `src/data/schema.ts` (tipos nuevos; mantener CRLF);
  - `pipeline/src/main.ts` (mantener CRLF);
  - `pipeline/src/validate.ts`;
  - `.github/workflows/data.yml`: no hay que cambiarlo si `ocr.json` se escribe en `out/`; solo hay que comprobar que se publica;
  - `pipeline/README.md`.

**Interfaces:**
- Schema (todo opcional):
  - `interface TripNote { mark: string; text: string; endsAt?: string; times: Record<string, TimeOfDay> }`:
    - `endsAt` es el código de parada de "Retirada en X", si X coincide con una parada de la línea;
    - `times` son las horas marcadas de ese viaje, por código de parada.
  - `Line.notes?: Record<DayType, TripNote[]>`.
  - `interface SchedulePeriod { name: string; validFrom: string; validTo: string }`.
  - `interface Notice { id: string; from: string; to: string; es: string; en: string }`, con las fechas en formato `AAAA-MM-DD`.
  - `Dataset.period?: SchedulePeriod` y `Dataset.notices?: Notice[]`.
- `notes.ts`:
  - `buildNotes(line: Line, day: DayType, parsed: ParsedPdf[], stops: Record<string, Stop>): { notes: TripNote[]; trips: (TimeOfDay|null)[][]; errors: string[] }`.
  - **Agrupar las marcas:** las marcas con la misma letra se agrupan por el viaje de `line.trips[day]` que contiene esa hora en esa parada. Una marca que no está en ningún viaje es un error.
  - **"Retirada en X":** `/^retirada en (.+)$/i`. X se compara con los nombres de las paradas de la línea sin tildes, en minúscula, y con `nva.` = `nueva`, `avda.` = `avenida` y `pz.`/`pza.` = `plaza`. Si coincide una sola parada, va a `endsAt`; si no, es un error.
  - **Retiradas:** en los viajes con nota de retirada, todas las horas posteriores a la última parada marcada pasan a `null` en `trips`.
  - **Otras notas** (por ejemplo "Paso por Parque Tecnológico"): solo anotan el viaje.
- `ocrCache.ts`:
  - `interface CachedPdf { file: string; lastModified: string | null; contentLength: string | null; sha256: string; result: ParsedPdf }`;
  - `type OcrCacheFile = Record<string, CachedPdf>`, publicado en `out/ocr.json` y leído desde `https://sbn998.github.io/buses-jerez/ocr.json`, con 404 = vacío;
  - `decide(source, head: { lastModified, contentLength } | null, cached?: CachedPdf, manual?: CachedPdf): 'reuse' | 'manual' | 'ocr' | { error: string }`:
    - `manual`, si hay entrada manual y su `sha256` coincide con el del PDF descargado: lo comprueba `main` después de descargar;
    - `reuse`, si las cabeceras HEAD coinciden con la caché;
    - `reuse` con aviso, si el HEAD falló y hay caché;
    - `{ error }`, si el HEAD falló y no hay caché;
    - `ocr` en los demás casos.
- `main.ts`, después de construir los viajes y antes de `validate`:
  1. Descubre los PDF y falla si salen menos de `MIN_PDF_SOURCES`.
  2. Hace HEAD a cada uno.
  3. Descarga y lee solo los que hacen falta. Calcula `sha256`, aplica la entrada de `ocr-manual.json` si existe, y si no ejecuta el OCR con un solo worker.
  4. `parsePage` y `buildNotes`.
  5. **Bloquea** si un PDF leído hoy tiene `unreadable` o `errors`. Los PDF reutilizados de la caché ya se validaron el día que se leyeron.
  6. **Periodo:** todos los PDF con fechas tienen que coincidir. Si `parseStartDate` de `inf-util` no es `null`, tiene que ser igual a `validFrom`; si no coincide, bloquea.
  7. Escribe `notices.json` en `dataset.notices` (si es una lista válida) y `out/ocr.json`.
- `validate.ts`: si hay `period`, `validFrom <= validTo`. Cada `TripNote.times[code]` existe en `timesByStop[code][day]`.

- [ ] **Step 1:** Pruebas:
  - **`buildNotes` con la línea 1** (las marcas de la Task 3 y los datos de `bundled.json`):
    - 2 notas `lab`;
    - la `a` con `endsAt: '302'` (Moreno Mendoza), cuyo viaje termina en `418` y tiene `null` a partir de ahí;
    - la `b` con `endsAt: '343'` (Plaza Esteve).
  - **Nota que no es una retirada:** "Paso por Parque Tecnológico" no tiene `endsAt` y no cambia `trips`.
  - **"Retirada en Xyz"** con una parada que no existe da un error.
  - **`decide`:**
    - con las cabeceras iguales, `reuse`;
    - con un `Last-Modified` distinto, `ocr`;
    - **`reuses cached result when HEAD fails`:** si el HEAD da `null` y hay caché, `reuse`;
    - si el HEAD da `null` y no hay caché, un error.
  - **`validate`:** rechaza un periodo con `validFrom > validTo` y una nota con una hora que no está en el buscador.
- [ ] **Step 2:** Run `cd pipeline && npm test`. Expected: FAIL.
- [ ] **Step 3:** Implementar, y explicar en el README los pasos, el archivo manual y `notices.json`.
- [ ] **Step 4:** Run `cd pipeline && npm test && npx tsc --noEmit`, y en la raíz `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Run `cd pipeline && npm run build-data` en local (unos 20 minutos la primera vez; necesita internet). Expected:
  - termina con código 0;
  - `out/ocr.json` tiene 57 entradas;
  - `out/data.json` tiene `period.validTo === '2027-06-27'`.
  
  Si algún PDF real bloquea, se corrige el análisis (Task 3) o se documenta en el informe. No se escribe a mano en `ocr-manual.json` para tapar un error del análisis.
- [ ] **Step 6:** Commit `feat(pipeline): notas de viaje del OCR, caché y periodo de validez`.

### Task 5: Horarios y Cómo llego usan las notas

**Files:**
- Modify:
  - `src/components/schedule/TimesGrid.tsx`: nueva prop `marks?: Record<TimeOfDay, string>`, de hora a letra;
  - `src/components/schedule/NextBusCard.tsx`: nueva prop `note?: string`;
  - `src/app/(tabs)/horarios.tsx`;
  - `src/lib/schedule.ts`: la función nueva;
  - `src/i18n/es.ts` y `en.ts`.
- Test: ampliar `src/components/schedule/__tests__/` y `src/lib/__tests__/schedule.test.ts`, o el archivo de pruebas de `schedule.ts` que exista.

**Interfaces:**
- `notesAt(line: Line, day: DayType, stopCode: string): { marks: Record<TimeOfDay, string>; legend: { mark: string; text: string; endsAt?: string }[] }`, en `src/lib/schedule.ts`. Es pura y no traduce: la leyenda solo lleva las letras que aparecen en `marks`.
- **Etiqueta que se ve:** la monta el componente.
  - Si la nota tiene `endsAt`, es `t('schedule.onlyTo', { stop: stops[endsAt].name })`: "Solo hasta {{stop}}" en es y "Only to {{stop}}" en en.
  - Si no, es `text` tal cual.
- **`TimesGrid`:** al lado de cada hora marcada pone su letra en pequeño, y debajo de la tabla la leyenda "a: Solo hasta Moreno Mendoza". La letra va dentro del `accessibilityLabel` de la hora, por ejemplo "21:38, solo hasta Moreno Mendoza".
- **`NextBusCard`:** si el próximo bus está marcado, muestra la etiqueta debajo de la hora.
- **Cómo llego:** no cambia ningún código. Los viajes ya vienen cortados desde el pipeline (Task 4). Una prueba lo confirma.

- [ ] **Step 1:** Pruebas:
  - `notesAt` con una línea de prueba que tiene una nota `a` con `endsAt` devuelve la marca para esa hora en esa parada.
  - Horarios muestra `21:38` con la letra `a` y la leyenda "a: Solo hasta Moreno Mendoza". En inglés, "Only to Moreno Mendoza".
  - Una nota sin `endsAt` muestra su texto tal cual.
  - **`works without notes`:** una línea sin `notes` se ve igual que hoy, sin leyenda.
  - **Planificador:** con un viaje cortado (`null` después de la parada X), `planTrips` no ofrece bajar en una parada posterior a X con ese viaje.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): Horarios marca los viajes que terminan antes o tienen nota`.

### Task 6: Avisos al abrir la app

**Files:**
- Create:
  - `src/lib/notices.ts`;
  - `src/stores/dismissedNotices.ts`, como `favorites.ts`, con la clave `"dismissed-notices"`;
  - `src/components/NoticeBanner.tsx`;
  - sus pruebas.
- Modify: `src/app/_layout.tsx`, o el layout de las pestañas: donde mejor se vea en todas las pantallas sin tapar la barra inferior. `src/i18n/es.ts` y `en.ts`.

**Interfaces:**
- `interface AppNotice { id: string; text: string }`, ya traducido.
- `activeNotices(ds: Dataset, today: string, lang: 'es' | 'en', t: TFunction): AppNotice[]`, en `src/lib/notices.ts`, por orden:
  1. **Caducado:**
     - cuándo: `period` existe y `today > period.validTo`;
     - id: `period-expired-<validTo>`;
     - texto: `t('notices.expired', { date })`, que dice "Los horarios publicados eran válidos hasta el {{date}}. Puede que no estén al día." en es y "The published timetables were valid until {{date}}. They may be out of date." en en.
  2. **Cambio próximo:**
     - cuándo: `period` existe y `validTo − 4 días <= today <= validTo`. Son unos 5 días de aviso, contando el último día.
     - id: `period-change-<validTo>`;
     - texto: `t('notices.change', { date: validTo + 1 día })`, que dice "El {{date}} empieza un horario nuevo. Revisa tus horas habituales." en es y "A new timetable starts on {{date}}. Check your usual times." en en.
  3. **Avisos de `ds.notices`** con `from <= today <= to`, usando el texto `es` o `en`.
- `date` se formatea según el idioma: "28 de junio" o "June 28". `today` es la fecha local en `AAAA-MM-DD`.
- **Store:** `dismissed: string[]`, `dismiss(id)` e `isDismissed(id)`.
- **`NoticeBanner`:**
  - muestra el primer aviso que no se ha descartado, con el botón `t('notices.dontShowAgain')` ("No volver a mostrar" / "Don't show again") y un botón de cerrar;
  - **cerrar** lo oculta hasta que se vuelve a abrir la app;
  - **"No volver a mostrar"** guarda el id para siempre;
  - un aviso con otro id vuelve a salir.

- [ ] **Step 1:** Pruebas:
  - `activeNotices`:
    - con `validTo = '2027-06-27'`: el `2027-06-23` da el aviso de cambio con "28 de junio", y el `2027-06-22` no da nada;
    - **`warns when period expired`:** el `2027-06-28` da el aviso de caducado;
    - un aviso de `notices` sale solo entre `from` y `to`;
    - **`shows nothing without period or notices`:** sin `period` ni `notices`, devuelve `[]`.
  - `NoticeBanner`:
    - "No volver a mostrar" lo oculta, y al volver a montarlo sigue oculto (el store persiste);
    - cerrar lo oculta, pero al volver a montarlo con el store limpio en memoria sale otra vez;
    - un segundo aviso con otro id sale después de descartar el primero.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): avisos al abrir la app con "No volver a mostrar"`.

### Task 7: Publicar con los datos nuevos (con el autor)

- [ ] **Step 1 (pedir permiso al autor):** fusionar en main y lanzar `data.yml` a mano. La primera ejecución tarda unos 25 minutos por el OCR de los 57 PDF.
- [ ] **Step 2:** Comprobar que `https://sbn998.github.io/buses-jerez/ocr.json` tiene 57 entradas y que `data.json` tiene `period` y `notes` en la línea 1.
- [ ] **Step 3:** Run `npm run update-data` en la raíz para actualizar `bundled.json`, `npm test`, y commit `chore(app): datos incluidos con notas del OCR`.
