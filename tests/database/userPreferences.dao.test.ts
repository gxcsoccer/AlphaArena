/**
 * User Preferences DAO Tests (Issue #586)
 * 
 * Tests for user preferences data access layer
 */

import {
  getUserPreferences,
  getOrCreateUserPreferences,
  createUserPreferences,
  updateUserPreferences,
  updateLanguagePreference,
  isValidLanguage,
  isValidTheme,
} from '../../src/database/userPreferences.dao';

// Mock the Supabase client
jest.mock('../../src/database/client.js', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  })),
}));

describe('User Preferences DAO', () => {
  const mockUserId = 'test-user-id';

  describe('isValidLanguage', () => {
    it('should return true for valid languages', () => {
      expect(isValidLanguage('zh-CN')).toBe(true);
      expect(isValidLanguage('en-US')).toBe(true);
    });

    it('should return false for invalid languages', () => {
      expect(isValidLanguage('zh')).toBe(false);
      expect(isValidLanguage('en')).toBe(false);
      expect(isValidLanguage('fr')).toBe(false);
      expect(isValidLanguage('')).toBe(false);
    });
  });

  describe('isValidTheme', () => {
    it('should return true for valid themes', () => {
      expect(isValidTheme('light')).toBe(true);
      expect(isValidTheme('dark')).toBe(true);
      expect(isValidTheme('system')).toBe(true);
    });

    it('should return false for invalid themes', () => {
      expect(isValidTheme('auto')).toBe(false);
      expect(isValidTheme('')).toBe(false);
    });
  });
});

describe('User Preferences API Routes', () => {
  // These would be integration tests with a test database
  // For now, we test the validation functions
  
  describe('Language Preference Validation', () => {
    it('should accept zh-CN language code', () => {
      expect(isValidLanguage('zh-CN')).toBe(true);
    });

    it('should accept en-US language code', () => {
      expect(isValidLanguage('en-US')).toBe(true);
    });

    it('should reject invalid language codes', () => {
      expect(isValidLanguage('de')).toBe(false);
      expect(isValidLanguage('ja')).toBe(false);
      expect(isValidLanguage('')).toBe(false);
      expect(isValidLanguage(null as any)).toBe(false);
      expect(isValidLanguage(undefined as any)).toBe(false);
    });
  });

  describe('Theme Preference Validation', () => {
    it('should accept valid theme values', () => {
      expect(isValidTheme('light')).toBe(true);
      expect(isValidTheme('dark')).toBe(true);
      expect(isValidTheme('system')).toBe(true);
    });

    it('should reject invalid theme values', () => {
      expect(isValidTheme('')).toBe(false);
      expect(isValidTheme('blue')).toBe(false);
      expect(isValidTheme(null as any)).toBe(false);
    });
  });
});