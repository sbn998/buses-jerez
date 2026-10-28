# Instalar Buses Jerez en tu móvil Android

Guía para principiantes. Haz un paso cada vez, en orden. Tiempo total: unos 45 minutos, casi todo esperando la compilación.
Necesitas: el ordenador con este proyecto, un móvil Android y el móvil y el ordenador en la misma red wifi.

## Parte 1: crear el instalador (se hace una sola vez)

1. **Crea una cuenta gratuita en https://expo.dev** (botón "Sign Up"). No pide tarjeta. Apunta el nombre de usuario y la contraseña. (5 min)
2. **Abre una terminal** en la carpeta del proyecto (`D:\Coding Projects\buses-jerez`). (1 min)
3. **Inicia sesión desde la terminal** con `npx eas-cli login` y escribe tu usuario y contraseña de expo.dev. Si te pregunta si quieres instalar `eas-cli`, di que sí. (2 min)
4. **Vincula el proyecto** con `npx eas-cli init` y acepta crear el proyecto cuando lo pregunte. Esto añade un identificador a `app.json`. (2 min)
5. **Lanza la compilación** con `npx eas-cli build --profile development --platform android`. Si pregunta por crear unas claves de firma (keystore), acepta que las genere Expo. (Esperar entre 15 y 30 min; en la cuenta gratuita puede haber cola.)
6. **Copia el enlace al APK** que aparece al terminar (o búscalo en https://expo.dev, apartado Builds). (1 min)

## Parte 2: instalarlo en el móvil

7. **Abre el enlace en el móvil** (puedes escanear el código QR que muestra la terminal) y descarga el archivo APK. (3 min)
8. **Permite instalar apps de fuera de Play Store**: cuando Android lo pida, entra en Ajustes y activa "Permitir desde esta fuente" para el navegador que usaste. (2 min)
9. **Instala el APK** pulsando sobre el archivo descargado y "Instalar". Se creará la app "Buses Jerez" con un menú de desarrollo. (2 min)

## Parte 3: usarlo cada día

Importante: la app de desarrollo carga su código desde el ordenador, así que necesita el ordenador conectado (servidor `npx expo start` activo y misma wifi). No sirve para probar el modo sin conexión; para eso está la Parte 5.

10. **En el ordenador, arranca el servidor** con `npx expo start` en la carpeta del proyecto. Deja la terminal abierta. (1 min)
11. **Abre la app "Buses Jerez" en el móvil.** Escanea el QR de la terminal o elige el servidor que aparece en la lista, para abrir el proyecto desde la app de desarrollo. (1 min)

## Parte 4: comprobaciones

12. **Pestañas:** se ven las 5 pestañas de la app. (1 min)
13. **Horarios:** elige la línea 1 y la parada Plaza Esteve. El próximo bus y las horas coinciden con la web de Comujesa. (5 min)
14. **Idioma:** cambia el idioma del móvil a inglés, abre la app y comprueba que los textos cambian. Vuelve a ponerlo en español. (3 min)

## Parte 5: Prueba sin conexión (opcional, una vez)

15. **Compila la versión de prueba**, que lleva el código dentro y no necesita el ordenador: `npx eas-cli build --profile preview --platform android`. Usa la misma cuota gratuita mensual. (Esperar entre 15 y 30 min.)

**Aviso:** la versión de prueba usa el mismo nombre de paquete (`com.sbn998.busesjerez`), así que al instalarla **reemplaza la app de desarrollo**. Al terminar, restaura la de desarrollo con el paso 20.

16. **Descarga e instala el APK de prueba:** abre su enlace en el móvil, descárgalo y pulsa "Instalar" (ya tienes permitido instalar desde esa fuente, paso 8). No tiene menú de desarrollo; es la app normal. (5 min)
17. **Ábrela una vez con conexión** y espera a que carguen los horarios. (2 min)
18. **Activa el modo avión, cierra la app por completo y vuelve a abrirla.** No arranques ningún servidor. (2 min)
19. **Comprueba que Horarios sigue mostrando la línea 1 en Plaza Esteve.** Si falla, avisa del fallo tal cual y no lo arregles por tu cuenta ni busques atajos. (2 min)

20. **Restaura la app de desarrollo:** vuelve a instalar el APK de desarrollo desde el enlace del paso 6 (o en https://expo.dev, tu proyecto, Builds, elige la compilación de tipo development). (5 min)

## Si algo falla

- Si la compilación en la nube se niega por límite gratuito, la alternativa es `npx expo run:android`, que exige instalar antes Android Studio (con el SDK de Android) en el ordenador.
- Si la app no encuentra el ordenador, revisa que ambos estén en la misma wifi, o prueba `npx expo start --tunnel`.
