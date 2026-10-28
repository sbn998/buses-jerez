// Preparación de Jest: simula AsyncStorage (el almacén del móvil) para las pruebas.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
