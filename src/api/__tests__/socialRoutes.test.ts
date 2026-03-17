/**
 * Tests for Social Routes
 */

import request from 'supertest';
import express from 'express';
import socialRoutes from '../socialRoutes';

// Mock SocialDAO
jest.mock('../../database/social.dao', () => {
  const mockSocialDAO = {
    getUserById: jest.fn(),
    getUserByUsername: jest.fn(),
    updateUser: jest.fn(),
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
    isFollowing: jest.fn(),
    getFollowers: jest.fn(),
    getFollowing: jest.fn(),
    getUserBadges: jest.fn(),
    awardBadge: jest.fn(),
  };

  return {
    SocialDAO: jest.fn(() => mockSocialDAO),
  };
});

// Mock auth middleware
jest.mock('../authMiddleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  },
  optionalAuthMiddleware: (req: any, res: any, next: any) => {
    if (req.headers.authorization) {
      req.user = { id: 'test-user-id', email: 'test@example.com' };
    }
    next();
  },
}));

const app = express();
app.use(express.json());
app.use('/api/users', socialRoutes);

describe('Social Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/users/:username', () => {
    it('should return user profile for valid username', async () => {
      const { SocialDAO } = require('../../database/social.dao');
      const mockDAO = new SocialDAO();

      mockDAO.getUserByUsername.mockResolvedValue({
        id: 'user-123',
        username: 'testuser',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
        bio: 'Test bio',
        followersCount: 100,
        followingCount: 50,
        isPublic: true,
        createdAt: new Date('2024-01-01'),
      });

      mockDAO.isFollowing.mockResolvedValue(false);

      const response = await request(app)
        .get('/api/users/testuser')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('testuser');
      expect(response.body.data.followersCount).toBe(100);
    });

    it('should return 404 for non-existent user', async () => {
      const { SocialDAO } = require('../../database/social.dao');
      const mockDAO = new SocialDAO();

      mockDAO.getUserByUsername.mockResolvedValue(null);

      const response = await request(app).get('/api/users/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('PATCH /api/users/me/profile', () => {
    it('should update user profile', async () => {
      const { SocialDAO } = require('../../database/social.dao');
      const mockDAO = new SocialDAO();

      mockDAO.updateUser.mockResolvedValue({
        id: 'test-user-id',
        username: 'testuser',
        displayName: 'Updated Name',
        bio: 'New bio',
        followersCount: 0,
        followingCount: 0,
      });

      const response = await request(app)
        .patch('/api/users/me/profile')
        .set('Authorization', 'Bearer test-token')
        .send({
          displayName: 'Updated Name',
          bio: 'New bio',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.displayName).toBe('Updated Name');
    });
  });

  describe('POST /api/users/:userId/follow', () => {
    it('should follow a user', async () => {
      const { SocialDAO } = require('../../database/social.dao');
      const mockDAO = new SocialDAO();

      mockDAO.isFollowing.mockResolvedValue(false);
      mockDAO.getUserById.mockResolvedValue({
        id: 'target-user-id',
        username: 'targetuser',
      });
      mockDAO.followUser.mockResolvedValue({
        id: 'follow-123',
        followerId: 'test-user-id',
        followingId: 'target-user-id',
      });

      const response = await request(app)
        .post('/api/users/target-user-id/follow')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully followed user');
    });

    it('should return 400 if already following', async () => {
      const { SocialDAO } = require('../../database/social.dao');
      const mockDAO = new SocialDAO();

      mockDAO.isFollowing.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/users/target-user-id/follow')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Already following this user');
    });

    it('should return 400 if trying to follow self', async () => {
      const response = await request(app)
        .post('/api/users/test-user-id/follow')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot follow yourself');
    });
  });

  describe('DELETE /api/users/:userId/follow', () => {
    it('should unfollow a user', async () => {
      const { SocialDAO } = require('../../database/social.dao');
      const mockDAO = new SocialDAO();

      mockDAO.isFollowing.mockResolvedValue(true);
      mockDAO.unfollowUser.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/users/target-user-id/follow')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully unfollowed user');
    });

    it('should return 400 if not following', async () => {
      const { SocialDAO } = require('../../database/social.dao');
      const mockDAO = new SocialDAO();

      mockDAO.isFollowing.mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/users/target-user-id/follow')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Not following this user');
    });
  });

  describe('GET /api/users/:userId/followers', () => {
    it('should return list of followers', async () => {
      const { SocialDAO } = require('../../database/social.dao');
      const mockDAO = new SocialDAO();

      mockDAO.getUserById.mockResolvedValue({
        id: 'user-123',
        username: 'testuser',
      });

      mockDAO.getFollowers.mockResolvedValue([
        {
          id: 'follower-1',
          username: 'follower1',
          displayName: 'Follower One',
          followersCount: 10,
          followingCount: 5,
        },
        {
          id: 'follower-2',
          username: 'follower2',
          displayName: 'Follower Two',
          followersCount: 20,
          followingCount: 10,
        },
      ]);

      const response = await request(app).get('/api/users/user-123/followers');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/users/:userId/following', () => {
    it('should return list of following', async () => {
      const { SocialDAO } = require('../../database/social.dao');
      const mockDAO = new SocialDAO();

      mockDAO.getUserById.mockResolvedValue({
        id: 'user-123',
        username: 'testuser',
      });

      mockDAO.getFollowing.mockResolvedValue([
        {
          id: 'following-1',
          username: 'following1',
          displayName: 'Following One',
          followersCount: 100,
          followingCount: 50,
        },
      ]);

      const response = await request(app).get('/api/users/user-123/following');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/users/:username/badges', () => {
    it('should return user badges', async () => {
      const { SocialDAO } = require('../../database/social.dao');
      const mockDAO = new SocialDAO();

      mockDAO.getUserByUsername.mockResolvedValue({
        id: 'user-123',
        username: 'testuser',
      });

      mockDAO.getUserBadges.mockResolvedValue([
        {
          id: 'badge-1',
          badgeType: 'trade_master',
          badgeName: 'Trade Master',
          badgeDescription: 'Completed 100 trades',
          badgeIcon: '🏆',
          earnedAt: new Date('2024-01-01'),
        },
      ]);

      const response = await request(app).get('/api/users/testuser/badges');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].badgeName).toBe('Trade Master');
    });
  });
});
