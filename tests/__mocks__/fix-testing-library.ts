// Fix for @testing-library/dom global config
// Note: The configure/getConfig getter issue in Jest is a known problem
// that requires either Jest or @testing-library to fix

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