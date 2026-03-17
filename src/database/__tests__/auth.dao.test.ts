/**
 * Tests for AuthDAO
 */

import { AuthDAO } from '../auth.dao';

// Mock Supabase client
jest.mock('../client', () => ({
  getSupabaseClient: () => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              id: 'test-user-id',
              email: 'test@example.com',
              username: 'testuser',
              password_hash: 'hashedpassword',
              email_verified: false,
              is_active: true,
              role: 'user',
              login_count: 0,
              failed_login_attempts: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          })),
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            data: null,
            error: { code: 'PGRST116' }, // Not found
          })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: { id: 'test-user-id' },
              error: null,
            })),
          })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          error: null,
        })),
      })),
    })),
    rpc: jest.fn(() => ({
      error: null,
      data: 1,
    })),
  }),
}));

describe('AuthDAO', () => {
  describe('createUser', () => {
    it('should create a new user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hashedpassword',
      };

      const user = await AuthDAO.createUser(userData);

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.username).toBe('testuser');
    });

    it('should normalize email to lowercase', async () => {
      const userData = {
        email: 'TEST@EXAMPLE.COM',
        password_hash: 'hashedpassword',
      };

      const user = await AuthDAO.createUser(userData);

      expect(user.email).toBe('test@example.com');
    });
  });

  describe('getUserByIdentifier', () => {
    it('should return null for non-existent user', async () => {
      const user = await AuthDAO.getUserByIdentifier('nonexistent@example.com');
      expect(user).toBeNull();
    });
  });

  describe('updatePassword', () => {
    it('should update user password', async () => {
      await expect(
        AuthDAO.updatePassword('test-user-id', 'newhash')
      ).resolves.not.toThrow();
    });
  });

  describe('createSession', () => {
    it('should create a session with valid data', async () => {
      const sessionData = {
        user_id: 'test-user-id',
        refresh_token: 'test-refresh-token',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      await expect(AuthDAO.createSession(sessionData)).resolves.toBeDefined();
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      await expect(
        AuthDAO.deleteSession('test-refresh-token')
      ).resolves.not.toThrow();
    });
  });

  describe('deleteAllUserSessions', () => {
    it('should delete all sessions for a user', async () => {
      await expect(
        AuthDAO.deleteAllUserSessions('test-user-id')
      ).resolves.not.toThrow();
    });
  });
});
