// Mock for @testing-library/dom
// Fixes the issue where configure and getConfig are undefined in Jest
// due to a problem with how getters are handled

const realDom = jest.requireActual('@testing-library/dom/dist/index.js');
const config = jest.requireActual('@testing-library/dom/dist/config.js');

// Create a proxy that intercepts all module access
// This ensures that both the main module and internal modules get correct values
const proxiedDom = new Proxy(realDom, {
  get(target, prop) {
    // Return the actual function for configure and getConfig
    if (prop === 'configure') {
      return config.configure;
    }
    if (prop === 'getConfig') {
      return config.getConfig;
    }
    // Return other properties from the real module
    return target[prop];
  }
});

module.exports = proxiedDom;