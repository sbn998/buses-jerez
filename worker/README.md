# Worker de rutas a pie

Intermediario en Cloudflare entre la app y OpenRouteService (ORS). La app le manda un origen y
hasta 10 puntos, y él devuelve los metros a pie de cada uno. Guarda los resultados en la caché de
Cloudflare 30 días para gastar pocas peticiones del plan gratuito. La clave de ORS vive solo en
Cloudflare, nunca en el repositorio ni en la app.

## Contrato

`POST /walk` con `{ "origin": [lon, lat], "points": [[lon, lat], ...], "direction": "from" | "to" }`.

- `from`: del origen a cada punto. `to`: de cada punto al origen.
- 200: `{ "meters": [número | null, ...] }`, en el mismo orden que `points`.
- 400 petición no válida, 405 si no es POST, 502 si ORS falla (`{ "error": <estado> }`).

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
3. `npx wrangler secret put ORS_API_KEY` y pega la clave de ORS cuando la pida. Escríbela solo en
   la terminal: no la pongas en ningún archivo ni en el chat.
4. `npx wrangler deploy`. Al acabar muestra la URL, algo como `https://buses-jerez-walk.<tu-subdominio>.workers.dev`.
5. Prueba con curl (cambia la URL por la tuya):

```
curl -X POST https://buses-jerez-walk.<tu-subdominio>.workers.dev/walk \
  -H "content-type: application/json" \
  -d '{"origin":[-6.1361,36.6866],"points":[[-6.11,36.6705]],"direction":"from"}'
```

Debe responder algo como `{"meters":[3200]}`. Si repites el curl, la segunda respuesta sale de la
caché (más rápida y sin gastar ORS).
