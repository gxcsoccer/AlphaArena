// Polyfill for TextEncoder/TextDecoder
import { TextEncoder, TextDecoder } from 'util';

if (typeof (global as any).TextEncoder === 'undefined') {
  (global as any).TextEncoder = TextEncoder;
}
if (typeof (global as any).TextDecoder === 'undefined') {
  (global as any).TextDecoder = TextDecoder;
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
