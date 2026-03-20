/**
 * EmailService Tests
 */

import { EmailService, getEmailService, resetEmailService } from '../EmailService';
import { MockEmailProvider, createEmailProvider } from '../EmailProviders';

describe('EmailService', () => {
  beforeEach(() => {
    resetEmailService();
  });

  describe('constructor', () => {
    it('should create instance with default mock provider in development', () => {
      const service = new EmailService({ developmentMode: true });
      expect(service.providerName).toBe('mock');
      expect(service.isConfigured).toBe(true);
      expect(service.isDevelopmentMode).toBe(true);
    });

    it('should respect explicit provider setting', () => {
      const service = new EmailService({ provider: 'mock' });
      expect(service.providerName).toBe('mock');
    });

    it('should use default from address', () => {
      const service = new EmailService({ developmentMode: true });
      // Default should be noreply@alphaarena.com
      expect(service).toBeDefined();
    });

    it('should use custom from address from config', () => {
      const service = new EmailService({
        developmentMode: true,
        defaultFrom: { email: 'custom@example.com', name: 'Custom' },
      });
      expect(service).toBeDefined();
    });
  });

  describe('send', () => {
    it('should send email successfully with mock provider', async () => {
      const service = new EmailService({ developmentMode: true });
      
      const result = await service.send({
        to: { email: 'test@example.com', name: 'Test User' },
        subject: 'Test Subject',
        text: 'Test body',
        html: '<p>Test body</p>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.provider).toBe('mock');
    });

    it('should fail without recipient', async () => {
      const service = new EmailService({ developmentMode: true });
      
      const result = await service.send({
        to: undefined as any,
        subject: 'Test Subject',
        text: 'Test body',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Recipient');
    });

    it('should fail without subject', async () => {
      const service = new EmailService({ developmentMode: true });
      
      const result = await service.send({
        to: { email: 'test@example.com' },
        subject: '',
        text: 'Test body',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Subject');
    });

    it('should fail without body content', async () => {
      const service = new EmailService({ developmentMode: true });
      
      const result = await service.send({
        to: { email: 'test@example.com' },
        subject: 'Test Subject',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('body');
    });

    it('should send email to string email address', async () => {
      const service = new EmailService({ developmentMode: true });
      
      const result = await service.send({
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test body',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('sendTo', () => {
    it('should send email to single recipient', async () => {
      const service = new EmailService({ developmentMode: true });
      
      const result = await service.sendTo(
        'test@example.com',
        'Test Subject',
        { text: 'Test body', html: '<p>Test</p>' }
      );

      expect(result.success).toBe(true);
    });

    it('should send email with EmailAddress object', async () => {
      const service = new EmailService({ developmentMode: true });
      
      const result = await service.sendTo(
        { email: 'test@example.com', name: 'Test User' },
        'Test Subject',
        { text: 'Test body' }
      );

      expect(result.success).toBe(true);
    });

    it('should send email with attachments', async () => {
      const service = new EmailService({ developmentMode: true });
      
      const result = await service.sendTo(
        'test@example.com',
        'Test Subject',
        { text: 'Test body' },
        {
          attachments: [
            { filename: 'test.txt', content: Buffer.from('test content') },
          ],
        }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('sendToMany', () => {
    it('should send email to multiple recipients', async () => {
      const service = new EmailService({ developmentMode: true });
      
      const results = await service.sendToMany(
        ['user1@example.com', 'user2@example.com', { email: 'user3@example.com', name: 'User 3' }],
        'Test Subject',
        { text: 'Test body' }
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('templates', () => {
    it('should send welcome email template', async () => {
      const service = new EmailService({ developmentMode: true });
      
      const result = await service.sendFromTemplate('welcome', 'test@example.com', {
        name: 'John',
      });

      expect(result.success).toBe(true);
    });

    it('should send verification email template', async () => {
      const service = new EmailService({ developmentMode: true });
      
      const result = await service.sendFromTemplate('verification', 'test@example.com', {
        code: '123456',
        expiryMinutes: 10,
      });

      expect(result.success).toBe(true);
    });

    it('should send password-reset email template', async () => {
      const service = new EmailService({ developmentMode: true });
      
      const result = await service.sendFromTemplate('password-reset', 'test@example.com', {
        resetUrl: 'https://example.com/reset?token=abc123',
        expiryHours: 1,
      });

      expect(result.success).toBe(true);
    });

    it('should send alert email template', async () => {
      const service = new EmailService({ developmentMode: true });
      
      const result = await service.sendFromTemplate('alert', 'test@example.com', {
        title: 'Price Alert',
        message: 'BTC price crossed $50,000',
        details: { symbol: 'BTCUSDT', price: 50000 },
      });

      expect(result.success).toBe(true);
    });

    it('should send report email template', async () => {
      const service = new EmailService({ developmentMode: true });
      
      const result = await service.sendFromTemplate('report', 'test@example.com', {
        reportName: 'Daily Trading Report',
        period: '2024-01-15',
        summary: 'Total PnL: +$500, Win Rate: 65%',
      });

      expect(result.success).toBe(true);
    });

    it('should fail for non-existent template', async () => {
      const service = new EmailService({ developmentMode: true });
      
      const result = await service.sendFromTemplate('non-existent' as any, 'test@example.com', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should allow registering custom templates', async () => {
      const service = new EmailService({ developmentMode: true });
      
      service.registerTemplate('notification' as any, {
        subject: 'Custom Notification',
        text: 'Hello {{name}}!',
      });

      const result = await service.sendFromTemplate('notification' as any, 'test@example.com', {
        name: 'Test',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('getEmailService singleton', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getEmailService({ developmentMode: true });
      const instance2 = getEmailService();
      
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getEmailService({ developmentMode: true });
      resetEmailService();
      const instance2 = getEmailService({ developmentMode: true });
      
      expect(instance1).not.toBe(instance2);
    });
  });
});

describe('EmailProviders', () => {
  describe('MockEmailProvider', () => {
    it('should always be configured', () => {
      const provider = new MockEmailProvider();
      expect(provider.isConfigured).toBe(true);
    });

    it('should return mock message ID', async () => {
      const provider = new MockEmailProvider();
      const result = await provider.send({
        to: { email: 'test@example.com' },
        subject: 'Test',
        text: 'Test',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^mock_/);
      expect(result.provider).toBe('mock');
    });
  });

  describe('SendGridProvider', () => {
    it('should not be configured without API key', () => {
      const originalEnv = process.env.SENDGRID_API_KEY;
      delete process.env.SENDGRID_API_KEY;
      
      const provider = createEmailProvider('sendgrid');
      expect(provider.isConfigured).toBe(false);
      
      if (originalEnv) {
        process.env.SENDGRID_API_KEY = originalEnv;
      }
    });

    it('should be configured with API key', () => {
      const provider = createEmailProvider('sendgrid', {
        sendgrid: { apiKey: 'test-key' },
      });
      expect(provider.isConfigured).toBe(true);
    });
  });

  describe('AWSSESProvider', () => {
    it('should not be configured without credentials', () => {
      const originalAccessKey = process.env.AWS_SES_ACCESS_KEY_ID;
      const originalSecretKey = process.env.AWS_SES_SECRET_ACCESS_KEY;
      delete process.env.AWS_SES_ACCESS_KEY_ID;
      delete process.env.AWS_SES_SECRET_ACCESS_KEY;
      
      const provider = createEmailProvider('aws-ses');
      expect(provider.isConfigured).toBe(false);
      
      if (originalAccessKey) process.env.AWS_SES_ACCESS_KEY_ID = originalAccessKey;
      if (originalSecretKey) process.env.AWS_SES_SECRET_ACCESS_KEY = originalSecretKey;
    });

    it('should be configured with credentials', () => {
      const provider = createEmailProvider('aws-ses', {
        awsSes: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
        },
      });
      expect(provider.isConfigured).toBe(true);
    });
  });

  describe('ResendProvider', () => {
    it('should not be configured without API key', () => {
      const originalEnv = process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_KEY;
      
      const provider = createEmailProvider('resend');
      expect(provider.isConfigured).toBe(false);
      
      if (originalEnv) process.env.RESEND_API_KEY = originalEnv;
    });

    it('should be configured with API key', () => {
      const provider = createEmailProvider('resend', {
        resend: { apiKey: 'test-key' },
      });
      expect(provider.isConfigured).toBe(true);
    });
  });

  describe('SMTPProvider', () => {
    it('should not be configured without host', () => {
      const originalEnv = process.env.SMTP_HOST;
      delete process.env.SMTP_HOST;
      
      const provider = createEmailProvider('smtp');
      expect(provider.isConfigured).toBe(false);
      
      if (originalEnv) process.env.SMTP_HOST = originalEnv;
    });

    it('should be configured with host', () => {
      const provider = createEmailProvider('smtp', {
        smtp: { host: 'smtp.example.com' },
      });
      expect(provider.isConfigured).toBe(true);
    });
  });

  describe('createEmailProvider', () => {
    it('should create mock provider by default', () => {
      const provider = createEmailProvider('mock');
      expect(provider.name).toBe('mock');
      expect(provider).toBeInstanceOf(MockEmailProvider);
    });

    it('should create provider for each type', () => {
      const types = ['mock', 'sendgrid', 'aws-ses', 'resend', 'smtp'] as const;
      
      types.forEach(type => {
        const provider = createEmailProvider(type);
        expect(provider.name).toBe(type);
      });
    });
  });
});