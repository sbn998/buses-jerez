// Configuración de Jest (las pruebas de la app).
// "pipeline/" tiene sus propias pruebas con vitest, así que Jest las ignora.
module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/pipeline/'],
  setupFiles: ['<rootDir>/jest.setup.js'],
};
