/**
 * Tests for Social DAO - Follow, Block, and Activity functionality
 */

import { SocialDAO, User, UserFollow, UserBlock, UserActivity } from '../social.dao';

// Mock Supabase client
jest.mock('../client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
          range: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        in: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
        order: jest.fn(() => ({
          range: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ 
            data: { 
              id: 'test-id',
              follower_id: 'user1',
              following_id: 'user2',
              created_at: new Date().toISOString()
            }, 
            error: null 
          })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
      upsert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
  })),
}));

describe('SocialDAO', () => {
  let socialDAO: SocialDAO;

  beforeEach(() => {
    socialDAO = new SocialDAO();
    jest.clearAllMocks();
  });

  describe('Follow functionality', () => {
    describe('followUser', () => {
      it('should create a follow relationship', async () => {
        const result = await socialDAO.followUser('user1', 'user2');
        
        expect(result).toBeDefined();
        expect(result.followerId).toBe('user1');
        expect(result.followingId).toBe('user2');
      });
    });

    describe('unfollowUser', () => {
      it('should remove a follow relationship', async () => {
        await expect(socialDAO.unfollowUser('user1', 'user2')).resolves.not.toThrow();
      });
    });

    describe('isFollowing', () => {
      it('should return false when not following', async () => {
        const result = await socialDAO.isFollowing('user1', 'user2');
        expect(result).toBe(false);
      });
    });

    describe('getFollowers', () => {
      it('should return list of followers', async () => {
        const result = await socialDAO.getFollowers('user1');
        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('getFollowing', () => {
      it('should return list of following', async () => {
        const result = await socialDAO.getFollowing('user1');
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('Block functionality', () => {
    describe('blockUser', () => {
      it('should create a block relationship', async () => {
        // Mock the necessary methods
        const mockSupabase = require('../client').getSupabaseClient();
        mockSupabase.from.mockReturnValueOnce({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: {
                  id: 'block-id',
                  blocker_id: 'user1',
                  blocked_id: 'user2',
                  created_at: new Date().toISOString(),
                },
                error: null,
              })),
            })),
          })),
          delete: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ error: null })),
          })),
        });

        const result = await socialDAO.blockUser('user1', 'user2');
        
        expect(result).toBeDefined();
        expect(result.blockerId).toBe('user1');
        expect(result.blockedId).toBe('user2');
      });
    });

    describe('unblockUser', () => {
      it('should remove a block relationship', async () => {
        await expect(socialDAO.unblockUser('user1', 'user2')).resolves.not.toThrow();
      });
    });

    describe('hasBlocked', () => {
      it('should return false when not blocked', async () => {
        const result = await socialDAO.hasBlocked('user1', 'user2');
        expect(result).toBe(false);
      });
    });

    describe('getBlockedUsers', () => {
      it('should return list of blocked users', async () => {
        const result = await socialDAO.getBlockedUsers('user1');
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('Privacy checks', () => {
    describe('canViewProfile', () => {
      it('should return true for own profile', async () => {
        const result = await socialDAO.canViewProfile('user1', 'user1');
        expect(result).toBe(true);
      });

      it('should check public profile visibility', async () => {
        const result = await socialDAO.canViewProfile(null, 'user1');
        // Result depends on mock data
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('Activity functionality', () => {
    describe('logActivity', () => {
      it('should log user activity', async () => {
        const mockSupabase = require('../client').getSupabaseClient();
        mockSupabase.from.mockReturnValueOnce({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: {
                  id: 'activity-id',
                  user_id: 'user1',
                  activity_type: 'followed_user',
                  entity_type: 'user',
                  entity_id: 'user2',
                  entity_name: 'testuser',
                  entity_data: {},
                  is_public: true,
                  created_at: new Date().toISOString(),
                },
                error: null,
              })),
            })),
          })),
        });

        const result = await socialDAO.logActivity(
          'user1',
          'followed_user',
          'user',
          'user2',
          'testuser'
        );
        
        expect(result).toBeDefined();
        expect(result.activityType).toBe('followed_user');
      });
    });

    describe('getActivityFeed', () => {
      it('should return activities from followed users', async () => {
        const result = await socialDAO.getActivityFeed('user1');
        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('getUserActivities', () => {
      it('should return user activities', async () => {
        const result = await socialDAO.getUserActivities('user1');
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });
});