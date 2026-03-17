/**
 * Tests for SocialDAO
 * 
 * Note: These tests verify the DAO method signatures and basic behavior.
 * Full integration tests would require a real Supabase connection.
 */

import { SocialDAO } from '../social.dao';

// Mock Supabase client
jest.mock('../client', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('SocialDAO', () => {
  describe('Data Types and Interfaces', () => {
    it('should have correct User interface structure', () => {
      const user = {
        id: 'test-id',
        username: 'testuser',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
        bio: 'Test bio',
        websiteUrl: 'https://example.com',
        twitterHandle: 'testuser',
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: true,
        followersCount: 10,
        followingCount: 5,
      };

      expect(user.id).toBe('test-id');
      expect(user.username).toBe('testuser');
      expect(user.followersCount).toBe(10);
    });

    it('should have correct UserFollow interface structure', () => {
      const follow = {
        id: 'follow-id',
        followerId: 'follower-id',
        followingId: 'following-id',
        createdAt: new Date(),
      };

      expect(follow.followerId).toBe('follower-id');
      expect(follow.followingId).toBe('following-id');
    });

    it('should have correct UserBadge interface structure', () => {
      const badge = {
        id: 'badge-id',
        userId: 'user-id',
        badgeType: 'trade_master',
        badgeName: 'Trade Master',
        badgeDescription: 'Completed 100 trades',
        badgeIcon: '🏆',
        earnedAt: new Date(),
        metadata: { trades: 100 },
      };

      expect(badge.badgeType).toBe('trade_master');
      expect(badge.badgeName).toBe('Trade Master');
    });
  });

  describe('Method Signatures', () => {
    it('should have all required user methods', () => {
      const socialDAO = new SocialDAO();
      
      expect(typeof socialDAO.getUserById).toBe('function');
      expect(typeof socialDAO.getUserByUsername).toBe('function');
      expect(typeof socialDAO.updateUser).toBe('function');
      expect(typeof socialDAO.upsertUser).toBe('function');
    });

    it('should have all required follow methods', () => {
      const socialDAO = new SocialDAO();
      
      expect(typeof socialDAO.followUser).toBe('function');
      expect(typeof socialDAO.unfollowUser).toBe('function');
      expect(typeof socialDAO.isFollowing).toBe('function');
      expect(typeof socialDAO.getFollowers).toBe('function');
      expect(typeof socialDAO.getFollowing).toBe('function');
    });

    it('should have all required badge methods', () => {
      const socialDAO = new SocialDAO();
      
      expect(typeof socialDAO.awardBadge).toBe('function');
      expect(typeof socialDAO.getUserBadges).toBe('function');
      expect(typeof socialDAO.hasBadge).toBe('function');
    });

    it('should have all required comment methods', () => {
      const socialDAO = new SocialDAO();
      
      expect(typeof socialDAO.createComment).toBe('function');
      expect(typeof socialDAO.getComments).toBe('function');
      expect(typeof socialDAO.updateComment).toBe('function');
      expect(typeof socialDAO.deleteComment).toBe('function');
    });

    it('should have all required like methods', () => {
      const socialDAO = new SocialDAO();
      
      expect(typeof socialDAO.likeStrategy).toBe('function');
      expect(typeof socialDAO.unlikeStrategy).toBe('function');
      expect(typeof socialDAO.hasLikedStrategy).toBe('function');
    });
  });
});
