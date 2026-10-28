# Buses Jerez: documento de diseño

Fecha: 2026-10-28
Estado: revisado. Pendiente de la aprobación final del autor.

## 1. Para qué es

Estás en la calle en Jerez de la Frontera y necesitas saber **qué parada te toca y a qué hora pasa el bus**. Google Maps no tiene las paradas de los autobuses urbanos de Jerez, y la web oficial (Comujesa) no se usa bien desde el móvil.

La app resuelve tres situaciones reales:

1. **Sé la línea**: dime la parada de esa línea más cercana a mí y cuándo pasa.
2. **Sé a dónde voy** (por ejemplo, Centro Comercial Luz Shopping): dime qué línea o combinación de líneas me lleva.
3. **Quiero consultar**: ver líneas, recorridos, paradas y horarios completos.

Se publicará para cualquier persona de Jerez y para turistas, primero en Google Play (cuando el autor pueda pagar la cuenta de desarrollador). La publicación queda para el final.

## 2. Objetivos, no-objetivos y anti-objetivos

### Objetivos
- Horarios oficiales correctos y al día, sacados automáticamente de la web de Comujesa.
- Encontrar la parada más cercana y el próximo bus en pocos segundos.
- Buscador de destinos con opciones directas y con un transbordo.
- Funcionar sin conexión en todo lo que no necesite internet por naturaleza.
- Español e inglés.

### No-objetivos (fuera de esta versión)
- Tiempo real de llegada. El autor lo descarta: los buses se adelantan y atrasan demasiado como para que sea fiable.
- Autobuses interurbanos del Consorcio de la Bahía de Cádiz y líneas de pedanías (P-x).
- Cuentas de usuario, anuncios, notificaciones push.
- Rutas con 2 o más transbordos.
- Publicación en App Store (el código puede funcionar en iOS, pero no se publica).

### Anti-objetivos (fallos aunque "funcione")
- **Navegación poco amigable.** Si cuesta encontrar algo, la app ha fracasado.
- **Información desactualizada o falsa.** Mostrar una hora equivocada es peor que no mostrar nada. Ante la duda, se conserva el último dato bueno y se avisa al mantenedor.

## 3. Decisiones tomadas

### 3.1 Tecnología (decisión del autor, con propuesta mía aceptada)
- **React Native + Expo + TypeScript.**
- Pruebas en el móvil Android del autor con una development build de Expo (no Expo Go; ver 7.1).
- Publicación futura en Google Play con EAS Build.

### 3.2 Pantallas
Barra inferior con 5 pestañas: **Cerca de mí · Horarios · Cómo llego · Líneas · Recarga**. Icono de engranaje arriba a la derecha para **Opciones**.

Se han visto bocetos de Cerca de mí, Horarios (versión anterior) y Cómo llego. El autor aprobó Cerca de mí tal como estaba. Los bocetos están en `2026-10-28-bocetos/`:
- `cerca-de-mi.png`: aprobado tal cual.
- `horarios.png`: versión anterior. Falta el calendario y sobra el botón "Elegir día y hora" (ver Horarios abajo).
- `como-llego.png`: versión anterior. Falta el selector de orden y las opciones con transbordo, y las barras inferiores aún no tienen las 5 pestañas finales.
- `bocetos.html`: el código de los bocetos (`#a` a `#e`).

Los bocetos sirven para orientarse. El diseño visual final lo decide quien construya la app.

#### Cerca de mí
- Mapa con la posición del usuario y las paradas a menos de ~500 m.
- Lista de paradas ordenada por distancia, con metros y minutos andando ("120 m · 2 min").
- La parada más cercana aparece desplegada: cada línea que pasa, su sentido ("hacia San Telmo") y el próximo bus ("10:14 · 9 min"). Las demás aparecen plegadas, con sus líneas como iconos de colores, y se despliegan al tocarlas.
- Al tocar una línea de una parada, se abre **Horarios** con esa línea y esa parada ya elegidas.
- Las paradas favoritas aparecen arriba.
- **Sin conexión:** la ubicación funciona (el GPS no necesita internet). La lista funciona entera. El mapa muestra lo que haya en caché o el mapa descargado (ver Opciones). Si no hay nada, muestra un fondo liso con el punto del usuario y las paradas.

#### Horarios
- El usuario elige **línea** y **parada**. **No se preselecciona nada automáticamente** (decisión del autor: en una parada pasan varias líneas y es mejor dejar elegir). En la lista de paradas, las más cercanas pueden salir primero con su distancia, pero no se marca ninguna sola.
- Si se llega desde Cerca de mí, Líneas o Favoritos, línea y parada vienen ya puestas porque el usuario las ha elegido.
- **Calendario**: una tira de días arriba. Cada día lleva un color según su tipo (laborable, sábado o domingo/festivo), para verlo de un vistazo. Hoy está seleccionado por defecto y abre su horario. Al tocar otro día se abre el horario que le corresponde.
- Si el día elegido es hoy: tarjeta con el **próximo bus** en grande ("10:14 · en 9 min") y los 3 siguientes.
- Debajo, todas las horas de paso del día: las ya pasadas en gris y la siguiente resaltada (solo cuando es hoy).
- **Sin botón "elegir día y hora".** El autor lo vio redundante con el horario completo y el calendario.
- Estrella para guardar la combinación línea + parada en Favoritos.
- Debe quedar claro el sentido de la línea en esa parada.

#### Cómo llego
- Campo de búsqueda: lugar, comercio o calle de Jerez (por ejemplo "Luz Shopping", "Calle Larga", "Hospital").
- Origen: la ubicación del usuario. *(Decisión mía: el origen se puede cambiar escribiendo otro lugar.)*
- Resultados: una lista de opciones. Cada una muestra:
  - tiempo total estimado (andar + esperar + bus, según el horario oficial y la hora actual),
  - metros andando en total,
  - número de buses (directo o 1 transbordo), líneas, parada donde subir, parada donde bajar, parada de transbordo y espera.
- Selector de orden: **Más rápido · Menos andar · Menos transbordos**. El autor quiere que el usuario elija: quien tiene prisa prefiere andar más, y quien va cargado prefiere esperar y que le deje más cerca.
- Máximo **1 transbordo** *(decisión mía)*.
- Tiempo andando **por calles reales** cuando hay conexión (decisión del autor), con un servicio de rutas a pie basado en OSM.
- **Sin conexión, la pantalla entera muestra el aviso "Esta función necesita conexión"** (decisión del autor). No se dan resultados aproximados.
- *(Decisión mía)* Las rutas a pie pasan por un pequeño intermediario gratuito (por ejemplo un Cloudflare Worker) que guarda la clave de API fuera del móvil y guarda en caché los tramos parada↔destino repetidos. Si se agota la cuota gratuita o el servicio falla, se usa la distancia en línea recta con margen, **marcada claramente como "aproximada"** en cada resultado. No es lo mismo que el caso sin conexión: la búsqueda funciona y solo la distancia es estimada.
- Mapa con origen, destino y el recorrido propuesto.

#### Líneas
- Lista de las 18 líneas con su número, color y extremos ("Esteve – San Telmo"). La línea 15 tiene dos variantes (Nueva Jarilla y El Portal).
- Al tocar una línea: recorrido en el mapa y paradas en orden, separadas por sentido.
- Al tocar una parada: se abre Horarios con esa línea y parada.

#### Recarga
- Lista y mapa de los puntos de venta y recarga del bono multiviaje, con dirección.
- Fuente: https://www.comujesa.es/autobuses-urbanos/punto-venta-multiviaje

#### Opciones (engranaje)
- Idioma: Automático (el del móvil) / Español / English.
- Mapa sin conexión: descargar el mapa de Jerez (indicando el tamaño aproximado) y borrarlo.
- Información de datos: fecha de la última actualización de los horarios.
- Más adelante podría incluir un interruptor de notificaciones push. No entra en esta versión.

### 3.3 Avisos (sin pestaña propia)
- Un mensaje dentro de la app **al abrirla** (no push; decisión del autor, es menos invasivo).
- Uso principal: avisar con unos días de antelación (unos 5, *decisión mía*) de un cambio de horario, por ejemplo "El 28 de junio cambia al horario de verano".
- También cambios puntuales publicados por Comujesa (desvíos por Semana Santa o Feria, huelgas, servicios especiales).
- Botón **"No volver a mostrar"**: ese aviso desaparece para siempre en ese dispositivo. Un aviso distinto posterior vuelve a mostrarse con normalidad (comportamiento confirmado por el autor).

### 3.4 Favoritos
- Se guarda una combinación línea + parada con una estrella (desde Horarios o Cerca de mí).
- Aparecen arriba en Cerca de mí con el próximo bus.
- Se guardan solo en el dispositivo.

### 3.5 Idiomas
- Español e inglés (pensando en turistas). Los nombres de paradas y líneas no se traducen.

### 3.6 Datos y actualización

**Horarios: horario oficial, sin tiempo real.** Se actualizan automáticamente desde la web de Comujesa (decisión del autor: prefiere más trabajo de construcción antes que actualizarlos a mano).

Fuentes investigadas (comprobadas el 2026-10-28):

1. **Paradas por línea (con código de parada):**
   `POST https://www.comujesa.es/autobuses-urbanos/paradas-y-horarios/listar-c-consultas` con `valorLinea=<n>`.
   Devuelve HTML con `<option value='<código>'>Nombre Descripción`. Ejemplo para la línea 1: `343` Plaza Esteve, `453` Villamarta, `30` Arcos…
2. **Horas de paso por parada y línea:**
   `POST https://www.comujesa.es/autobuses-urbanos/paradas-y-horarios/listar-b` con `valorCaja1=<código parada>&valorLinea=<n>`.
   Devuelve HTML con tres bloques de texto: "Laborables", "Sábados" y "Domingos y Festivos", cada uno con una lista de horas `HH:MM`. Comprobado: coincide con el PDF oficial de la línea 1.
3. **Páginas de línea** con las paradas separadas por sentido:
   `https://www.comujesa.es/autobuses-urbanos/lineas-paradas-y-horarios/linea-<n>`.
4. **PDFs de horario** (son imágenes escaneadas, no tienen texto):
   `https://www.comujesa.es/fileadmin/Documentos/Autobuses_Urbanos/horario_invierno/LINEA_<n>_{LAB,SAB,FES}.pdf` (la línea 15 tiene además `LINEA_15_NJ_*`). La cabecera indica el periodo de validez ("Horarios válidos desde 07/09/2026 al 27/06/2027") y los códigos de parada por sentido. Las notas de viajes que terminan antes ("21:38a = retirada en Moreno Mendoza") solo aparecen en los PDF.
5. **Mapas oficiales de Comujesa (Google My Maps), fuente principal de ubicaciones y recorridos.** Cada página de línea incrusta un mapa (`<iframe src="https://www.google.com/maps/d/…embed?mid=<id>">`; ojo, a veces con `/u/1/` en la ruta). Se puede descargar en KML con `https://www.google.com/maps/d/kml?mid=<id>&forcekml=1`. Cada parada trae nombre, **código** (el mismo de los horarios), sentido y latitud/longitud, por ejemplo `Plaza Esteve | COD: 343 SENTIDO: Esteve | -6.136679,36.681745`. Cada mapa incluye además el recorrido como línea (`LineString`). Comprobado el 2026-10-28: hay mapa para las 18 líneas, incluidas las dos variantes de la línea 15. Comujesa avisa de que el recorrido es "meramente orientativo". Hay al menos una discrepancia de código: Madre de Dios figura como 280 en el mapa y como 352 en el buscador o el PDF. La validación debe cruzar códigos entre fuentes.
6. **OpenStreetMap (fuente secundaria):** 535 paradas (`highway=bus_stop`) en Jerez con coordenadas, y relaciones `route=bus` de "Autobuses Urbanos de Jerez" (operador COMUJESA) para las líneas 1–14 y 16–18, con su color y su recorrido. **La línea 15 no está en OSM.**

**Ubicación de paradas y recorridos:** de los **mapas oficiales de Comujesa** (fuente 5), enlazados por código de parada con los horarios. Decisión del autor: son oficiales y deberían ser más precisos que OSM. El proceso diario también descarga estos mapas, porque las paradas pueden cambiar. OSM solo se usa para cruzar datos (avisar si una parada oficial está a más de X m de la de OSM) y como último recurso. Un archivo de correcciones manuales cubre las discrepancias que no se resuelvan solas.

**Viajes que no completan el recorrido (decisión del autor: opción OCR).** Las horas marcadas con letra en los PDF ("21:38a = retirada en Moreno Mendoza") se leen automáticamente con OCR, solo esas marcas y su leyenda, cuando cambia un PDF. Comprobaciones: cada hora marcada leída por OCR tiene que existir en los datos del buscador para esa parada, y la leyenda tiene que nombrar una parada conocida de la línea. Si no cuadra, la publicación se bloquea y el autor recibe un correo. La app trata esos viajes como terminados en la parada indicada: no los ofrece en Cómo llego más allá de ella, y en Horarios los marca ("solo hasta Moreno Mendoza"). El mismo OCR puede leer de la cabecera las fechas de validez del horario, que sirven para los avisos de cambio (3.3).

**Repositorio:** **un único repositorio público** desde el principio (decisión del autor). Incluye el código de la app, el proceso de datos, los datos publicados (GitHub Pages) y el mapa sin conexión (GitHub Releases). Reglas (decisión del autor):
- Solo se sube lo estrictamente necesario para que la app funcione. El `.gitignore` es estricto.
- **Nunca** se suben claves de API de ningún tipo (van en secretos de GitHub Actions, en el intermediario o en variables locales ignoradas por git) ni información personal.
- Los commits usan la dirección privada de GitHub (`…@users.noreply.github.com`), no el correo personal del autor.

**Proceso de actualización (decisión mía):**
- Repositorio en GitHub (el autor tiene cuenta). Un proceso programado de GitHub Actions se ejecuta una vez al día: consulta Comujesa, genera los datos y los publica como archivos estáticos con GitHub Pages en el mismo repositorio, con un manifiesto de versión.
- **Validación antes de publicar:** están todas las líneas esperadas; cada parada de cada línea tiene horas en al menos un tipo de día; las horas tienen el formato correcto y van en orden; no hay caídas bruscas (por ejemplo, que desaparezca más de un X % de paradas o de horas respecto a la versión anterior). Si algo falla, **no se publica**: se mantiene la versión anterior y el proceso falla, con lo que GitHub envía un correo al autor.
- **App:** lleva una copia de los datos incluida. Al abrirla con conexión, comprueba el manifiesto y descarga la versión nueva si la hay. Sin conexión, usa la última copia. Siempre muestra la fecha de actualización.

**Festivos:** el calendario necesita los festivos nacionales, andaluces y locales de Jerez. En esos días se aplica el horario "Domingos y Festivos". Se publican junto con los horarios. *(Decisión mía: nacionales y autonómicos desde una fuente automática si existe; los 2 festivos locales, a mano una vez al año en un archivo del repositorio.)*

## 4. Restricciones
- Coste cero siempre (ver 4.1).
- Servicios externos con normas de uso: Nominatim/Photon (búsqueda de lugares), OpenRouteService (rutas a pie, unas 2.000 consultas al día gratis), teselas de OSM (**prohibido descargarlas en masa**, por eso el mapa sin conexión debe ser un mapa propio de Jerez generado a partir de datos OSM y alojado por nosotros, por ejemplo en GitHub Releases; tamaño estimado de 20 a 50 MB).
- El sistema de actualización depende de la web de Comujesa, que puede cambiar sin avisar. Debe fallar de forma ruidosa y segura.
- Atribución de OpenStreetMap obligatoria en la app.

### 4.1 Coste cero garantizado (requisito del autor)
Regla general: **no se registra ninguna tarjeta de pago en ningún servicio.** Así, si se supera un límite gratuito, el servicio deja de funcionar o devuelve un error, pero nunca cobra. La app tiene que funcionar razonablemente en ese caso.

| Servicio | Uso | Límite gratis | Qué pasa si se supera |
|---|---|---|---|
| GitHub Actions (repo público) | proceso diario | ilimitado en repos públicos con runners estándar | — |
| GitHub Pages + Releases (mismo repo) | horarios, paradas y mapa sin conexión | ~100 GB/mes de tráfico (límite blando) | GitHub puede limitar el tráfico. No cobra. |
| Mapa de fondo | mapa propio de Jerez (generado con datos OSM) alojado en el repo, **también cuando hay conexión** | el de GitHub | no depende de servidores de teselas de terceros |
| OpenRouteService | rutas a pie | ~2.000 consultas/día, sin tarjeta | error, y se usa la distancia "aproximada" (ver Cómo llego) |
| Cloudflare Workers | intermediario de rutas a pie | 100.000 peticiones/día, sin tarjeta | error, y se usa la distancia "aproximada" |
| Búsqueda de lugares (Photon/Nominatim públicos) | Cómo llego | uso razonable, sin tarjeta | pueden bloquear si se abusa. Hay que limitar las peticiones (sin autocompletar en cada letra, con caché). Si fallan, se muestra un error claro. |
| Compilación de la app | development build y APK | EAS Build tiene capa gratuita mensual. Si se agota, se compila en local con Android Studio (gratis). | nada |
| OCR | Tesseract dentro de Actions | gratis | — |

**Único coste fuera de esta regla:** la cuenta de desarrollador de Google Play (unos 25 USD, un solo pago) cuando el autor decida publicar. Es opcional: la app se puede distribuir gratis como APK directo o por F-Droid.

Cualquier servicio nuevo que se añada tiene que cumplir esta regla y aparecer en esta tabla.

## 5. Éxito
- En la calle, con la app abierta, saber el próximo bus de la parada cercana en 1 o 2 toques.
- Encontrar cómo llegar a Luz Shopping sin saber la línea.
- Los horarios mostrados coinciden con los oficiales vigentes.
- El autor prueba cada pantalla en su móvil antes de pasar a la siguiente.

## 6. Lo que queda en manos de quien lo construya
- Estructura del proyecto, librerías concretas, gestión de estado y almacenamiento local.
- Formato exacto de los archivos de datos y del manifiesto.
- Reconstrucción de los **viajes** (qué hora de una parada corresponde a qué hora de la siguiente) a partir de las horas por parada, necesaria para Cómo llego y para saber a qué hora llegas. Ojo: hay viajes que empiezan a mitad de recorrido (en el PDF de la línea 1, el primer bus empieza en Constitución a las 7:10), así que emparejar por posición no basta.
- Cómo determinar el sentido de cada parada (páginas de línea, PDFs u OSM).
- Algoritmo de Cómo llego (radio de búsqueda de paradas, penalizaciones).
- Diseño visual, accesibilidad (texto grande, contraste) y modo oscuro.
- Proveedor concreto de búsqueda de lugares y de rutas a pie, y cómo proteger la clave de API.
- Fuente de los avisos puntuales (desvíos, huelgas). Para las fechas de cambio de horario, ver el OCR en 3.6.

## 7. Decisiones tras la revisión
### 7.1 App de desarrollo en lugar de Expo Go (decisión del autor)
El mapa propio descargable (vectorial, tipo MapLibre) necesita módulos nativos que no funcionan en Expo Go. **Se usa una "development build" de Expo** desde el principio: sigue siendo Expo y se prueba en el móvil Android del autor, pero instalando una app de desarrollo propia. Montarla es uno de los primeros pasos del plan.
