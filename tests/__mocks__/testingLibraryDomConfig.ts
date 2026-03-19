// Mock for @testing-library/dom/dist/config.js
// Fixes the issue where configure and getConfig are undefined in Jest
// due to a problem with how the config module is loaded

const config = jest.requireActual('@testing-library/dom/dist/config.js');

module.exports = {
  configure: config.configure,
  getConfig: config.getConfig,
  runWithExpensiveErrorDiagnosticsDisabled: config.runWithExpensiveErrorDiagnosticsDisabled,
};