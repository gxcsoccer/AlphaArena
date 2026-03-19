// Fix for @testing-library/dom circular dependency issue in Jest
// This uses a global variable to bypass the module system's circular dependency issues

// First, patch the config module to export to a global
const configModule = require('@testing-library/dom/dist/config');

// Store the working functions globally
if (typeof (global as any).__DTL_CONFIG__ === 'undefined') {
  (global as any).__DTL_CONFIG__ = {
    configure: configModule.configure,
    getConfig: configModule.getConfig,
  };
}

// Now patch all the modules that use config
const domIndex = require('@testing-library/dom');
if (typeof domIndex.configure !== 'function') {
  domIndex.configure = (global as any).__DTL_CONFIG__.configure;
  domIndex.getConfig = (global as any).__DTL_CONFIG__.getConfig;
}

console.log('[Setup] Testing library patches applied with global config');