// Configure React Testing Library for React 18
import { configure } from '@testing-library/react';

// Suppress React 18 act warnings - Arco Design form updates trigger async state changes
configure({
  reactStrictMode: false,
});

// Mock Arco Design icons - create simple mock components
jest.mock('@arco-design/web-react/icon', () => {
  const React = require('react');
  // Create mock icon components dynamically
  const createIconComponent = (name: string) => {
    const IconComponent = ({ style, children, className, ...props }: any) => 
      React.createElement('span', { 
        'data-icon': name, 
        style, 
        className,
        ...props 
      }, children);
    IconComponent.displayName = name;
    return IconComponent;
  };

  // Return a proxy that creates mock components for any Icon* export
  return new Proxy({}, {
    get: (target, prop) => {
      if (typeof prop === 'string') {
        return createIconComponent(prop);
      }
      return undefined;
    },
  });
});

// Polyfill for TextEncoder/TextDecoder
import { TextEncoder, TextDecoder } from 'util';

if (typeof (global as any).TextEncoder === 'undefined') {
  (global as any).TextEncoder = TextEncoder;
}
if (typeof (global as any).TextDecoder === 'undefined') {
  (global as any).TextDecoder = TextDecoder;
}

// Polyfill for fetch (Node.js < 18)
// In Node.js 18+, fetch is available globally
// For older Node.js versions, we use undici (available in Node.js 18+ as well)
if (typeof global.fetch === 'undefined') {
  try {
    // Try to use undici which is bundled with Node.js 18+
     
    const { fetch, Headers, Request, Response } = require('undici');
    global.fetch = fetch as any;
    global.Headers = Headers as any;
    global.Request = Request as any;
    global.Response = Response as any;
  } catch {
    // If undici is not available, provide a simple mock
    global.fetch = (() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    })) as any;
  }
}

// Set required environment variables for tests
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-min-32-chars';
}
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://test-project.supabase.co';
}
if (!process.env.SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = 'test-anon-key-for-testing';
}
if (!process.env.DEEPSEEK_API_KEY) {
  process.env.DEEPSEEK_API_KEY = 'test-deepseek-api-key';
}

// Mock pdfmake before any module imports it
jest.mock('pdfmake', () => {
  return class PdfPrinter {
    constructor() {}
    createPdfKitDocument() {
      return { pipe: () => {}, end: () => {}, on: () => {} };
    }
  };
});

// Clear Supabase mock data between tests
beforeEach(() => {
  try {
    const { clearMockData } = require('./supabase');
    clearMockData();
  } catch {
    // Ignore if module not found
  }
});
