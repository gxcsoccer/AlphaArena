/**
 * Mock for ResizeObserver
 */

class ResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

global.ResizeObserver = ResizeObserver as any;
export default ResizeObserver;
