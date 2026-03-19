// Mock for @testing-library/dom
// Fixes the issue where configure and getConfig are undefined in Jest
// due to a problem with how getters are handled

const realDom = jest.requireActual('@testing-library/dom');
const config = jest.requireActual('@testing-library/dom/dist/config.js');
const events = jest.requireActual('@testing-library/dom/dist/events.js');
const getQueries = jest.requireActual('@testing-library/dom/dist/get-queries-for-element.js');
const queries = jest.requireActual('@testing-library/dom/dist/queries/index.js');

// Create a new object by manually copying properties
const mockDom: Record<string, unknown> = {};

// Copy all enumerable properties that have defined values
for (const key of Object.keys(realDom)) {
  try {
    const value = (realDom as Record<string, unknown>)[key];
    if (value !== undefined) {
      mockDom[key] = value;
    }
  } catch {
    // Ignore errors from getters
  }
}

// Override configure and getConfig with actual functions
mockDom.configure = config.configure;
mockDom.getConfig = config.getConfig;

// Ensure fireEvent is available
if (!mockDom.fireEvent && events.fireEvent) {
  mockDom.fireEvent = events.fireEvent;
}

// Ensure getQueriesForElement is available
if (!mockDom.getQueriesForElement && getQueries.getQueriesForElement) {
  mockDom.getQueriesForElement = getQueries.getQueriesForElement;
}

// Ensure screen is available - it's a getter that returns queries bound to document.body
if (!mockDom.screen) {
  // Create screen object with all query methods bound to document.body
  const screenObj: Record<string, unknown> = {};
  const queryMethods = Object.keys(queries);
  for (const method of queryMethods) {
    const fn = (queries as Record<string, unknown>)[method];
    if (typeof fn === 'function') {
      screenObj[method] = fn.bind(null, document.body);
    }
  }
  mockDom.screen = screenObj;
}

module.exports = mockDom;