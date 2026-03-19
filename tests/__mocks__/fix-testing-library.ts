// Fix for @testing-library/dom - ensures the global config cache is available
// for modules that use the global workaround (e.g. pretty-dom.js)

// Store in global for modules that use the global workaround
if (typeof (global as any).__DTL_CONFIG__ === 'undefined') {
import config from '@testing-library/dom/dist/config';
  (global as any).__DTL_CONFIG__ = {
    configure: config.configure,
    getConfig: config.getConfig,
  };
}

console.log('[Setup] Testing library patches applied');