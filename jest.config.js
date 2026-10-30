// Configuración de Jest (las pruebas de la app).
// "pipeline/" y "worker/" tienen sus propias pruebas con vitest, así que Jest las ignora.
module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/pipeline/', '/worker/'],
  setupFiles: ['<rootDir>/jest.setup.js'],
};
