# Proceso de datos de Buses Jerez

Esta carpeta es un programa pequeño, separado de la app, que **descarga los horarios oficiales de Comujesa, los revisa y los publica** para que la app los use. Se ejecuta solo, cada noche, en GitHub.

## La idea en 4 pasos

1. **Descargar.** Pregunta a la web de Comujesa, línea por línea y parada por parada, a qué horas pasa cada bus. También descarga el mapa oficial de cada línea, que trae la ubicación de cada parada.
2. **Ordenar.** Junta todo en un único archivo (`data.json`) con una forma fija. Esa forma está descrita en `src/data/schema.ts`, el "contrato" que comparten este proceso y la app.
3. **Revisar.** Comprueba que los datos tienen sentido: están las 18 líneas, cada parada tiene horas y ubicación, y las horas van en orden. **Si algo falla, no publica nada** y GitHub te manda un correo. La app sigue usando los últimos datos buenos.
4. **Publicar.** Sube `data.json` y `manifest.json` (un archivo pequeño que dice qué versión hay) a GitHub Pages, una web gratuita.

## Comandos

Ejecutar dentro de esta carpeta (`pipeline/`):

- `npm install`: instala lo que necesita el programa. Solo hace falta la primera vez.
- `npm test`: pasa las pruebas automáticas. Cada pieza tiene pruebas que comprueban que hace lo que debe.
- `npm run build-data`: ejecuta el proceso completo y deja el resultado en `out/`. La carpeta `out/` no se sube a git.

## Las piezas

Las piezas se van añadiendo conforme se construyen. Cada archivo empieza con un comentario que explica para qué sirve.

| Archivo | Qué hace |
|---|---|
| `../src/data/schema.ts` | Define la forma exacta de los datos (el contrato con la app). |
| `src/http.ts` | Descarga páginas de la web con cuidado: espera entre peticiones, reintenta si falla y se identifica. |
| `src/comujesa/endpoints.ts` | Guarda todas las direcciones de la web de Comujesa en un solo sitio. |
| `src/comujesa/parseStops.ts` | Lee la lista de paradas (con su código) de una línea. |
| `src/comujesa/parseTimes.ts` | Lee las horas de paso de una parada: laborables, sábados y festivos. |
| `src/comujesa/parseLinePage.ts` | Lee la página de una línea: sus sentidos ("hacia San Telmo") y el enlace a su mapa oficial. |
| `src/comujesa/parseKml.ts` | Lee el mapa oficial de una línea: ubicación y código de cada parada y el dibujo del recorrido. |
| `src/lineColours.ts` | El color de cada línea. |
| `src/assemble.ts` | Junta paradas, horas, sentidos y mapa de cada línea, y decide de dónde sale la ubicación de cada parada. |
| `overrides.json` | Correcciones manuales de ubicación de paradas, para los casos que el mapa oficial no resuelve. |
| `src/trips.ts` | Reconstruye los viajes: qué hora de cada parada corresponde al mismo autobús. |
| `src/holidays.ts` y `holidays-local.json` | Festivos nacionales y andaluces (automáticos) y locales de Jerez (a mano, una vez al año). |
| `src/topup.ts` y `topup-points.json` | Puntos de recarga de la tarjeta, copiados a mano del cartel oficial de Comujesa. |
| `src/validate.ts` | Revisa los datos antes de publicar. Si algo está roto o sospechoso, bloquea la publicación. |
| `src/cleanTimes.ts` | Corrige pequeños fallos de los datos oficiales: quita horas imposibles (como "00:01") y ordena las desordenadas. |
| `src/osm.ts` | Paradas de OpenStreetMap, el último recurso para ubicar paradas nuevas que no salen en los mapas oficiales. |
| `src/manifest.ts` | Crea `manifest.json`, con una "huella" de los datos para que la app sepa si han cambiado. |
| `src/main.ts` | El programa principal: ejecuta todos los pasos en orden y decide si se publica. |

## Qué revisar a mano de vez en cuando

- **`overrides.json`**: las paradas con `"approximate": true` tienen una ubicación estimada (copiada de su parada gemela) y la app lo indicará. Si pasas por ellas, comprueba dónde están exactamente y corrige la latitud y longitud.
- **`holidays-local.json`**: cada año, añade los 2 festivos locales de Jerez (salen en el BOJA, normalmente en octubre). No hace falta acordarse: desde octubre, GitHub abre una Issue para recordártelo. Formato: `{ "2027": [{ "date": "2027-10-09", "name": "San Dionisio" }] }`.
- **`holidays-regional-extra.json`**: cada primavera, el BOJA publica el decreto con las fiestas laborales de Andalucía del año siguiente. Si algún festivo se traslada al lunes (porque cae en domingo), date.nager.at no lo incluye: añádelo aquí. Formato: `{ "2027": [{ "date": "2027-03-01", "name": "Día de Andalucía (trasladado)" }] }`. La Issue mensual de GitHub también te lo recuerda.
- **`topup-points.json`**: Comujesa publica los puntos de recarga solo como una imagen (un cartel). Si cambia, GitHub abre una Issue "Ha cambiado el cartel de puntos de recarga": copia la lista nueva en `points`, y actualiza `posterImage` (la ruta de la imagen que contiene `RedVenta`) y `checked` (la fecha).
- **Avisos del proceso**: en GitHub → Actions → el último proceso, la sección de avisos lista lo que se ha corregido automáticamente.
| `src/previous.ts` | Descarga la versión publicada anterior para comparar. Si falla por algo que no sea "todavía no existe", no se publica. |
| `src/checkHolidays.ts` | Comprueba si faltan festivos locales. GitHub lo ejecuta el día 1 de cada mes y, si faltan, abre una Issue (te llega por correo). |
| `src/checkTopUp.ts` | Comprueba si Comujesa ha subido otro cartel de recarga. Lo ejecuta el mismo proceso mensual de GitHub y, si ha cambiado, abre una Issue. |
| `src/map/style.ts` | El estilo del mapa (colores y capas) para teselas de OpenStreetMap en formato OpenMapTiles. |
| `src/map/writeStyle.ts` | Escribe ese estilo en `out/map/style.json` (`npm run write-style`). Lo ejecuta el proceso diario. |

## El mapa de Jerez

El mapa se dibuja con datos de OpenStreetMap (© OpenStreetMap contributors, licencia ODbL) y no cuesta dinero: se genera una vez al mes en GitHub y se publica en la misma web que los horarios.

- **Mensual** (`.github/workflows/map.yml`, el día 1 de cada mes o a mano desde Actions → "Mapa mensual" → "Run workflow"): descarga Andalucía de Geofabrik, recorta Jerez, genera `jerez.pmtiles` y `fonts.zip` y los sube al Release `mapa` del repositorio. Si `jerez.pmtiles` pesa más de 80 MB, el proceso falla.
- **Diario** (`.github/workflows/data.yml`): después de `build-data` se baja el Release `mapa`, descomprime las tipografías en `out/map/fonts/` y ejecuta `npm run write-style`. Si el Release no existe todavía, avisa (`::warning::`) y publica los horarios sin mapa.
- **Primera vez**: lanza "Mapa mensual" a mano, y después "Datos diarios".
- **Direcciones públicas**: `https://sbn998.github.io/buses-jerez/map/style.json`, `…/map/jerez.pmtiles` y `…/map/fonts/{fontstack}/{range}.pbf`.

### Comandos exactos (para repetirlos a mano en Linux o Ubuntu)

```bash
sudo apt-get install -y osmium-tool zip
curl -fsSL -o andalucia.osm.pbf https://download.geofabrik.de/europe/spain/andalucia-latest.osm.pbf
osmium extract -b -6.35,36.55,-5.85,36.85 andalucia.osm.pbf -o jerez.osm.pbf --overwrite
```

tilemaker v3.2.0 no publica programas para Linux y su imagen de Docker solo existe como `:master`, así que se compila la etiqueta v3.2.0 (dependencias según su `docs/INSTALL.md`):

```bash
sudo apt-get install -y build-essential libboost-dev libboost-filesystem-dev \
  libboost-program-options-dev libboost-system-dev lua5.3 liblua5.3-dev \
  libshp-dev libsqlite3-dev rapidjson-dev
git clone --depth 1 --branch v3.2.0 https://github.com/systemed/tilemaker.git tilemaker-src
make -C tilemaker-src -j"$(nproc)"
# La configuración incluida pide archivos de costa y glaciares que no descargamos: se quitan esas 4 capas.
jq 'del(.layers.ocean, .layers.urban_areas, .layers.ice_shelf, .layers.glacier) | .settings.maxzoom = 14' \
  tilemaker-src/resources/config-openmaptiles.json > config.json
./tilemaker-src/tilemaker --input jerez.osm.pbf --output jerez.pmtiles \
  --config config.json --process tilemaker-src/resources/process-openmaptiles.lua
```

Con `maxzoom 14` las teselas se amplían en la app hasta el zoom 16 o más sin perder calidad. Tipografías (solo "Noto Sans Regular" y "Noto Sans Bold"):

```bash
curl -fsSL -o noto-sans.zip https://github.com/openmaptiles/fonts/releases/download/v2.0/noto-sans.zip
unzip -q noto-sans.zip "Noto Sans Regular/*" "Noto Sans Bold/*" -d fonts-src
(cd fonts-src && zip -qr ../fonts.zip .)
```
