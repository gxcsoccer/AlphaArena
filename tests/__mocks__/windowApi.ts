// Mock for missing window APIs in jsdom

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Mock MediaQueryList.addEventListener/removeEventListener
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
if (!window.ResizeObserver) {
  window.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
}

// Mock IntersectionObserver
if (!window.IntersectionObserver) {
  window.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
}

// Mock scrollTo
window.scrollTo = jest.fn();

// Mock URL.createObjectURL / revokeObjectURL
URL.createObjectURL = jest.fn(() => 'blob:test');
URL.revokeObjectURL = jest.fn();