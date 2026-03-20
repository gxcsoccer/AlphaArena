// Fix for @testing-library/dom - ensures the global config cache is available
// for modules that use the global workaround (e.g. pretty-dom.js)

// Store in global for modules that use the global workaround
if (typeof (global as any).__DTL_CONFIG__ === 'undefined') {
  const config = require('@testing-library/dom/dist/config');
  (global as any).__DTL_CONFIG__ = {
    configure: config.configure,
    getConfig: config.getConfig,
  };
}

// Mock scrollIntoView for jsdom (not supported by default)
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = jest.fn();
}

// Mock scrollTo for jsdom
if (typeof window !== 'undefined' && !window.scrollTo) {
  window.scrollTo = jest.fn();
}

// Mock scroll for jsdom
if (typeof window !== 'undefined' && !window.scroll) {
  window.scroll = jest.fn();
}

console.log('[Setup] Testing library patches applied');