// Ayuda para abrir la pestaña Horarios desde otras pantallas.

// Abre Horarios con una línea y una parada. El "nonce" (la hora actual en texto) cambia en cada
// llamada, así Horarios vuelve a aplicar los parámetros aunque línea y parada sean las mismas.
export function openSchedule(
  router: { push: (href: any) => void },
  lineId: string,
  stopCode: string,
): void {
  router.push({
    pathname: '/(tabs)/horarios',
    params: { line: lineId, stop: stopCode, nonce: String(Date.now()) },
  });
}
