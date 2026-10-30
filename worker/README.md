# Worker de rutas a pie

Intermediario en Cloudflare entre la app y OpenRouteService (ORS). La app le manda un origen y
hasta 10 puntos, y él devuelve los metros a pie de cada uno. Guarda los resultados en Workers KV (la
memoria de Cloudflare) 30 días para gastar pocas peticiones del plan gratuito. La clave de ORS vive solo en
Cloudflare, nunca en el repositorio ni en la app.

## Contrato

`POST /walk` con `{ "origin": [lon, lat], "points": [[lon, lat], ...], "direction": "from" | "to", "store": false }`.

- `store` es opcional (por defecto `true`; si viene, debe ser un booleano o da 400). Con `store: false` el Worker no lee ni guarda nada en KV para esa petición y va directo a ORS. La app lo manda cuando el origen es la ubicación GPS del usuario, para que esa posición no quede guardada en Cloudflare.
- Solo existe `POST /walk`: otras rutas dan 404 y otros métodos en `/walk` dan 405.
- `from`: del origen a cada punto. `to`: de cada punto al origen.
- 200: `{ "meters": [número | null, ...] }`, en el mismo orden que `points`.
- 400 petición no válida, 404 ruta distinta de `/walk`, 405 si no es POST, 502 si ORS falla (`{ "error": <estado> }`).

## Pruebas (sin cuenta ni red)

```
cd worker
npm install
npm test
npx tsc --noEmit
```

## Publicarlo (Task 4, unos 15 minutos)

Necesitas una cuenta gratuita de Cloudflare y una clave gratuita de OpenRouteService.

1. `cd worker && npm install`
2. `npx wrangler login` (se abre el navegador para autorizar).
3. `npx wrangler kv namespace create WALK_CACHE`. Este comando solo imprime un bloque con el `id`:
   no edita ningún archivo. Cópialo tú y pégalo en `wrangler.toml` en lugar de `PON_AQUI_EL_ID`
   (el id no es secreto).
4. `npx wrangler secret put ORS_API_KEY` y pega la clave de ORS cuando la pida. Escríbela solo en
   la terminal: no la pongas en ningún archivo ni en el chat.
5. `npx wrangler deploy`. En una cuenta nueva puede pedirte registrar tu subdominio `workers.dev`:
   acéptalo (o regístralo en el panel de Cloudflare, en Workers & Pages). Al acabar muestra la URL, algo como `https://buses-jerez-walk.<tu-subdominio>.workers.dev`.
6. Prueba dos veces (cambia la URL por la tuya).

En PowerShell (Windows):

```
Invoke-RestMethod -Method Post -Uri https://buses-jerez-walk.<tu-subdominio>.workers.dev/walk -ContentType 'application/json' -Body '{"origin":[-6.1361,36.6866],"points":[[-6.11,36.6705]],"direction":"from"}'
```

En Git Bash, Linux o macOS:

```
curl -X POST https://buses-jerez-walk.<tu-subdominio>.workers.dev/walk \
  -H "content-type: application/json" \
  -d '{"origin":[-6.1361,36.6866],"points":[[-6.11,36.6705]],"direction":"from"}'
```

Debe responder algo como `{"meters":[3200]}`. La segunda vez sale de KV sin gastar cuota de ORS
(KV puede tardar hasta un minuto en reflejar una escritura nueva).

Límites gratuitos de KV: 100 000 lecturas y 1 000 escrituras al día. Cada punto nuevo es una
escritura; si se agotan, el Worker sigue respondiendo pero gasta más cuota de ORS.
