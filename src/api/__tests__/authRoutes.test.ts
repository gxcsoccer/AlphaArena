/**
 * Tests for Authentication Routes
 */

import request from 'supertest';
import express from 'express';
import authRoutes from '../authRoutes';
import { AuthDAO } from '../../database/auth.dao';
import bcrypt from 'bcrypt';

// Mock AuthDAO
jest.mock('../../database/auth.dao');
jest.mock('bcrypt');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hashedpassword',
        email_verified: false,
        is_active: true,
        role: 'user',
        login_count: 0,
        failed_login_attempts: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (AuthDAO.getUserByEmail as jest.Mock).mockResolvedValue(null);
      (AuthDAO.getUserByUsername as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      (AuthDAO.createUser as jest.Mock).mockResolvedValue(mockUser);
      (AuthDAO.createSession as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'Password123',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should reject registration with existing email', async () => {
      (AuthDAO.getUserByEmail as jest.Mock).mockResolvedValue({
        id: 'existing-user',
        email: 'existing@example.com',
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email already registered');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid email format');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        is_active: true,
        email_verified: true,
        role: 'user',
        login_count: 0,
        failed_login_attempts: 0,
      };

      (AuthDAO.getUserByIdentifier as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (AuthDAO.recordSuccessfulLogin as jest.Mock).mockResolvedValue(undefined);
      (AuthDAO.createSession as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        is_active: true,
        failed_login_attempts: 0,
      };

      (AuthDAO.getUserByIdentifier as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      (AuthDAO.recordFailedLogin as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login for non-existent user', async () => {
      (AuthDAO.getUserByIdentifier as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'nonexistent@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      (AuthDAO.deleteSession as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/logout')
        .send({
          refreshToken: 'test-refresh-token',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const mockSession = {
        id: 'session-id',
        user_id: 'user-id',
        refresh_token: 'test-refresh-token',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        role: 'user',
        is_active: true,
      };

      (AuthDAO.getSessionByRefreshToken as jest.Mock).mockResolvedValue(mockSession);
      (AuthDAO.getUserById as jest.Mock).mockResolvedValue(mockUser);
      (AuthDAO.updateSessionLastUsed as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'test-refresh-token',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should reject invalid refresh token', async () => {
      (AuthDAO.getSessionByRefreshToken as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid refresh token');
    });
  });
});
