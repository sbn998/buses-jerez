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
