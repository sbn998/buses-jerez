// Configuración de las pruebas automáticas (vitest) del proceso de datos.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
