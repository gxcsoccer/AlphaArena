/**
 * Email Providers Interface
 * Defines the contract for email service providers
 */

import { createLogger } from '../utils/logger';

const log = createLogger('EmailProviders');

/**
 * Email address with optional name
 */
export interface EmailAddress {
  email: string;
  name?: string;
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  contentId?: string; // For inline images
}

/**
 * Email message structure
 */
export interface EmailMessage {
  to: EmailAddress | EmailAddress[];
  from?: EmailAddress;
  replyTo?: EmailAddress;
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: Record<string, string>;
}

/**
 * Email send result
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
}

/**
 * Base interface for email providers
 */
export interface IEmailProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/**
 * Mock Email Provider
 * Used for development and testing - logs emails instead of sending
 */
export class MockEmailProvider implements IEmailProvider {
  readonly name = 'mock';
  readonly isConfigured = true;

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const toList = Array.isArray(message.to) ? message.to : [message.to];
    const toEmails = toList.map(a => a.name ? `${a.name} <${a.email}>` : a.email).join(', ');

    log.info('[MOCK EMAIL] Email would be sent:', {
      to: toEmails,
      from: message.from,
      subject: message.subject,
      textPreview: message.text?.substring(0, 100),
      hasHtml: !!message.html,
      attachments: message.attachments?.length ?? 0,
    });

    // In development, also log full email content for debugging
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n========== MOCK EMAIL ==========');
      console.log('To:', toEmails);
      console.log('From:', message.from?.email ?? 'noreply@alphaarena.com');
      console.log('Subject:', message.subject);
      console.log('---');
      if (message.text) {
        console.log('Text Body:\n', message.text);
      }
      if (message.html) {
        console.log('HTML Body (preview):\n', message.html.substring(0, 500) + '...');
      }
      if (message.attachments?.length) {
        console.log('Attachments:', message.attachments.map(a => a.filename).join(', '));
      }
      console.log('=================================\n');
    }

    // Generate a mock message ID
    const messageId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      messageId,
      provider: 'mock',
    };
  }
}

/**
 * SendGrid Email Provider Configuration
 */
export interface SendGridConfig {
  apiKey: string;
}

/**
 * SendGrid Email Provider
 * Note: Actual implementation requires @sendgrid/mail package
 */
export class SendGridProvider implements IEmailProvider {
  readonly name = 'sendgrid';
  private apiKey: string | null = null;

  constructor(config?: SendGridConfig) {
    this.apiKey = config?.apiKey ?? process.env.SENDGRID_API_KEY ?? null;
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        provider: 'sendgrid',
        error: 'SendGrid API key not configured',
      };
    }

    // Placeholder for actual SendGrid implementation
    // To implement: install @sendgrid/mail and use it here
    log.warn('SendGrid provider not fully implemented - falling back to mock');
    
    return {
      success: false,
      provider: 'sendgrid',
      error: 'SendGrid integration not implemented. Install @sendgrid/mail and implement the send method.',
    };
  }
}

/**
 * AWS SES Email Provider Configuration
 */
export interface AWSESConfig {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

/**
 * AWS SES Email Provider
 * Note: Actual implementation requires @aws-sdk/client-ses package
 */
export class AWSSESProvider implements IEmailProvider {
  readonly name = 'aws-ses';
  private config: AWSESConfig;

  constructor(config?: AWSESConfig) {
    this.config = {
      region: config?.region ?? process.env.AWS_SES_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
      accessKeyId: config?.accessKeyId ?? process.env.AWS_SES_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: config?.secretAccessKey ?? process.env.AWS_SES_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY,
    };
  }

  get isConfigured(): boolean {
    return !!(this.config.accessKeyId && this.config.secretAccessKey);
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        provider: 'aws-ses',
        error: 'AWS SES credentials not configured',
      };
    }

    // Placeholder for actual AWS SES implementation
    // To implement: install @aws-sdk/client-ses and use it here
    log.warn('AWS SES provider not fully implemented - falling back to mock');
    
    return {
      success: false,
      provider: 'aws-ses',
      error: 'AWS SES integration not implemented. Install @aws-sdk/client-ses and implement the send method.',
    };
  }
}

/**
 * Resend Email Provider Configuration
 */
export interface ResendConfig {
  apiKey: string;
}

/**
 * Resend Email Provider
 * Note: Actual implementation requires resend package
 */
export class ResendProvider implements IEmailProvider {
  readonly name = 'resend';
  private apiKey: string | null = null;

  constructor(config?: ResendConfig) {
    this.apiKey = config?.apiKey ?? process.env.RESEND_API_KEY ?? null;
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        provider: 'resend',
        error: 'Resend API key not configured',
      };
    }

    // Placeholder for actual Resend implementation
    // To implement: install resend package and use it here
    log.warn('Resend provider not fully implemented - falling back to mock');
    
    return {
      success: false,
      provider: 'resend',
      error: 'Resend integration not implemented. Install resend package and implement the send method.',
    };
  }
}

/**
 * SMTP Email Provider Configuration
 */
export interface SMTPConfig {
  host: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
}

/**
 * SMTP Email Provider
 * Note: Actual implementation requires nodemailer package
 */
export class SMTPProvider implements IEmailProvider {
  readonly name = 'smtp';
  private config: SMTPConfig;

  constructor(config?: SMTPConfig) {
    this.config = {
      host: config?.host ?? process.env.SMTP_HOST ?? '',
      port: config?.port ?? parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: config?.secure ?? process.env.SMTP_SECURE === 'true',
      user: config?.user ?? process.env.SMTP_USER,
      password: config?.password ?? process.env.SMTP_PASSWORD,
    };
  }

  get isConfigured(): boolean {
    return !!(this.config.host);
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        provider: 'smtp',
        error: 'SMTP host not configured',
      };
    }

    // Placeholder for actual SMTP implementation
    // To implement: install nodemailer and use it here
    log.warn('SMTP provider not fully implemented - falling back to mock');
    
    return {
      success: false,
      provider: 'smtp',
      error: 'SMTP integration not implemented. Install nodemailer and implement the send method.',
    };
  }
}

/**
 * Provider type enum
 */
export type EmailProviderType = 'mock' | 'sendgrid' | 'aws-ses' | 'resend' | 'smtp';

/**
 * Email Provider Factory Configuration
 */
export interface EmailProviderConfig {
  default?: EmailProviderType;
  sendgrid?: SendGridConfig;
  awsSes?: AWSESConfig;
  resend?: ResendConfig;
  smtp?: SMTPConfig;
}

/**
 * Create an email provider instance
 */
export function createEmailProvider(type: EmailProviderType, config?: EmailProviderConfig): IEmailProvider {
  switch (type) {
    case 'sendgrid':
      return new SendGridProvider(config?.sendgrid);
    case 'aws-ses':
      return new AWSSESProvider(config?.awsSes);
    case 'resend':
      return new ResendProvider(config?.resend);
    case 'smtp':
      return new SMTPProvider(config?.smtp);
    case 'mock':
    default:
      return new MockEmailProvider();
  }
}

export default {
  MockEmailProvider,
  SendGridProvider,
  AWSSESProvider,
  ResendProvider,
  SMTPProvider,
  createEmailProvider,
};