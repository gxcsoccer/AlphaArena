/**
 * Email Service
 * Unified email sending interface with multiple provider support
 */

import { createLogger } from '../utils/logger';
import {
  IEmailProvider,
  EmailMessage,
  EmailSendResult,
  EmailAddress,
  EmailAttachment,
  EmailProviderType,
  EmailProviderConfig,
  createEmailProvider,
  MockEmailProvider,
} from './EmailProviders.js';

const log = createLogger('EmailService');

// Re-export types for convenience
export type {
  EmailMessage,
  EmailSendResult,
  EmailAddress,
  EmailAttachment,
} from './EmailProviders.js';

/**
 * Email Service Configuration
 */
export interface EmailServiceConfig {
  /**
   * Default provider to use
   * Can be set via EMAIL_PROVIDER env var
   * Defaults to 'mock' in development, or 'sendgrid' if configured
   */
  provider?: EmailProviderType;

  /**
   * Default 'from' address for all emails
   * Can be set via EMAIL_FROM env var
   */
  defaultFrom?: EmailAddress;

  /**
   * Default reply-to address
   */
  defaultReplyTo?: EmailAddress;

  /**
   * Provider-specific configurations
   */
  providers?: EmailProviderConfig;

  /**
   * Enable development mode (always use mock provider)
   */
  developmentMode?: boolean;
}

/**
 * Template data for email templates
 */
export type TemplateData = Record<string, unknown>;

/**
 * Email template type
 */
export type EmailTemplateType =
  | 'welcome'
  | 'verification'
  | 'password-reset'
  | 'notification'
  | 'alert'
  | 'report';

/**
 * Email template definition
 */
export interface EmailTemplate {
  subject: string | ((data: TemplateData) => string);
  text?: string | ((data: TemplateData) => string);
  html?: string | ((data: TemplateData) => string);
}

/**
 * Email Service - Main email sending service
 * 
 * Features:
 * - Multiple provider support (SendGrid, AWS SES, Resend, SMTP)
 * - Mock mode for development
 * - Email templating
 * - Unified interface for all email operations
 * 
 * @example
 * // Basic usage
 * const emailService = new EmailService();
 * await emailService.send({
 *   to: { email: 'user@example.com', name: 'John' },
 *   subject: 'Welcome!',
 *   html: '<h1>Welcome to AlphaArena</h1>',
 * });
 * 
 * @example
 * // Using templates
 * await emailService.sendFromTemplate('welcome', { email: 'user@example.com' }, { name: 'John' });
 */
export class EmailService {
  private provider: IEmailProvider;
  private defaultFrom: EmailAddress;
  private defaultReplyTo?: EmailAddress;
  private developmentMode: boolean;
  private templates: Map<EmailTemplateType, EmailTemplate> = new Map();

  constructor(config: EmailServiceConfig = {}) {
    // Determine if we're in development mode
    this.developmentMode = config.developmentMode ?? 
      (process.env.NODE_ENV !== 'production' && process.env.EMAIL_PROVIDER !== 'production');

    // Determine provider
    let providerType: EmailProviderType;

    if (this.developmentMode && !process.env.EMAIL_PROVIDER) {
      // In development mode without explicit provider, use mock
      providerType = 'mock';
      log.info('EmailService running in development mode - emails will be logged only');
    } else {
      providerType = config.provider ?? 
        (process.env.EMAIL_PROVIDER as EmailProviderType) ?? 
        'mock';
    }

    // Create provider instance
    this.provider = createEmailProvider(providerType, config.providers);

    // Set default from address
    const defaultFromEmail = config.defaultFrom?.email ?? 
      process.env.EMAIL_FROM ?? 
      'noreply@alphaarena.com';
    const defaultFromName = config.defaultFrom?.name ?? 
      process.env.EMAIL_FROM_NAME ?? 
      'AlphaArena';
    
    this.defaultFrom = {
      email: defaultFromEmail,
      name: defaultFromName,
    };

    // Set default reply-to
    this.defaultReplyTo = config.defaultReplyTo;

    // Register default templates
    this.registerDefaultTemplates();

    log.info('EmailService initialized', {
      provider: this.provider.name,
      isConfigured: this.provider.isConfigured,
      developmentMode: this.developmentMode,
      defaultFrom: this.defaultFrom.email,
    });
  }

  /**
   * Get the current provider name
   */
  get providerName(): string {
    return this.provider.name;
  }

  /**
   * Check if the email provider is properly configured
   */
  get isConfigured(): boolean {
    return this.provider.isConfigured;
  }

  /**
   * Check if running in development mode (mock provider)
   */
  get isDevelopmentMode(): boolean {
    return this.developmentMode || this.provider instanceof MockEmailProvider;
  }

  /**
   * Send an email
   */
  async send(message: EmailMessage): Promise<EmailSendResult> {
    // Apply defaults
    const fullMessage: EmailMessage = {
      ...message,
      from: message.from ?? this.defaultFrom,
      replyTo: message.replyTo ?? this.defaultReplyTo,
    };

    // Validate required fields
    if (!fullMessage.to) {
      return {
        success: false,
        error: 'Recipient (to) is required',
      };
    }

    if (!fullMessage.subject) {
      return {
        success: false,
        error: 'Subject is required',
      };
    }

    if (!fullMessage.text && !fullMessage.html) {
      return {
        success: false,
        error: 'Email body (text or html) is required',
      };
    }

    try {
      const result = await this.provider.send(fullMessage);
      
      if (result.success) {
        log.info('Email sent successfully', {
          to: Array.isArray(fullMessage.to) 
            ? fullMessage.to.map(a => a.email).join(', ') 
            : fullMessage.to.email,
          subject: fullMessage.subject,
          messageId: result.messageId,
          provider: result.provider,
        });
      } else {
        log.error('Failed to send email', new Error(result.error ?? 'Unknown error'), {
          to: Array.isArray(fullMessage.to) 
            ? fullMessage.to.map(a => a.email).join(', ') 
            : fullMessage.to.email,
          subject: fullMessage.subject,
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Exception while sending email', error);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send email to a single recipient
   */
  async sendTo(
    to: string | EmailAddress,
    subject: string,
    content: { text?: string; html?: string },
    options?: {
      from?: EmailAddress;
      replyTo?: EmailAddress;
      attachments?: EmailAttachment[];
      headers?: Record<string, string>;
      tags?: Record<string, string>;
    }
  ): Promise<EmailSendResult> {
    const toAddress: EmailAddress = typeof to === 'string' 
      ? { email: to } 
      : to;

    return this.send({
      to: toAddress,
      subject,
      text: content.text,
      html: content.html,
      from: options?.from,
      replyTo: options?.replyTo,
      attachments: options?.attachments,
      headers: options?.headers,
      tags: options?.tags,
    });
  }

  /**
   * Send email to multiple recipients
   */
  async sendToMany(
    recipients: (string | EmailAddress)[],
    subject: string,
    content: { text?: string; html?: string },
    options?: {
      from?: EmailAddress;
      replyTo?: EmailAddress;
      attachments?: EmailAttachment[];
      headers?: Record<string, string>;
      tags?: Record<string, string>;
    }
  ): Promise<EmailSendResult[]> {
    const results: EmailSendResult[] = [];

    for (const recipient of recipients) {
      const result = await this.sendTo(recipient, subject, content, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Register an email template
   */
  registerTemplate(type: EmailTemplateType, template: EmailTemplate): void {
    this.templates.set(type, template);
    log.debug('Email template registered', { type });
  }

  /**
   * Send email using a template
   */
  async sendFromTemplate(
    templateType: EmailTemplateType,
    to: string | EmailAddress,
    data: TemplateData,
    options?: {
      from?: EmailAddress;
      replyTo?: EmailAddress;
      attachments?: EmailAttachment[];
      additionalData?: TemplateData;
    }
  ): Promise<EmailSendResult> {
    const template = this.templates.get(templateType);
    
    if (!template) {
      return {
        success: false,
        error: `Template '${templateType}' not found`,
      };
    }

    // Merge template data
    const templateData = { ...data, ...options?.additionalData };

    // Resolve subject
    const subject = typeof template.subject === 'function' 
      ? template.subject(templateData) 
      : template.subject;

    // Resolve text body
    const text = template.text 
      ? (typeof template.text === 'function' 
          ? template.text(templateData) 
          : template.text)
      : undefined;

    // Resolve HTML body
    const html = template.html 
      ? (typeof template.html === 'function' 
          ? template.html(templateData) 
          : template.html)
      : undefined;

    return this.sendTo(to, subject, { text, html }, options);
  }

  /**
   * Register default email templates
   */
  private registerDefaultTemplates(): void {
    // Welcome email template
    this.registerTemplate('welcome', {
      subject: (data) => `Welcome to AlphaArena, ${data.name ?? 'there'}!`,
      text: (data) => 
`Welcome to AlphaArena${data.name ? `, ${data.name}` : ''}!

Your account has been successfully created.

Get started by exploring our features:
- Paper trading for practice
- Strategy backtesting
- Real-time market data

Happy trading!
The AlphaArena Team`,
      html: (data) => 
`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; background: #f9f9f9; }
    .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to AlphaArena</h1>
    </div>
    <div class="content">
      <p>Hello${data.name ? ` ${data.name}` : ''},</p>
      <p>Welcome to AlphaArena! Your account has been successfully created.</p>
      <p>Get started by exploring our features:</p>
      <ul>
        <li>Paper trading for practice</li>
        <li>Strategy backtesting</li>
        <li>Real-time market data</li>
      </ul>
      <p>Happy trading!</p>
      <p>The AlphaArena Team</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} AlphaArena. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`,
    });

    // Verification email template
    this.registerTemplate('verification', {
      subject: 'Verify your email address',
      text: (data) => 
`Please verify your email address

Your verification code is: ${data.code}

This code will expire in ${data.expiryMinutes ?? 10} minutes.

If you didn't request this verification, please ignore this email.`,
      html: (data) => 
`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea; padding: 20px; background: #f0f0f0; border-radius: 8px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Verify your email address</h2>
    <p>Your verification code is:</p>
    <div class="code">${data.code}</div>
    <p>This code will expire in ${data.expiryMinutes ?? 10} minutes.</p>
    <p>If you didn't request this verification, please ignore this email.</p>
  </div>
</body>
</html>`,
    });

    // Password reset email template
    this.registerTemplate('password-reset', {
      subject: 'Reset your password',
      text: (data) => 
`You requested to reset your password.

Click the link below to reset your password:
${data.resetUrl}

This link will expire in ${data.expiryHours ?? 1} hour(s).

If you didn't request this, please ignore this email and your password will remain unchanged.`,
      html: (data) => 
`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Reset your password</h2>
    <p>You requested to reset your password.</p>
    <p><a href="${data.resetUrl}" class="button">Reset Password</a></p>
    <p>Or copy this link: ${data.resetUrl}</p>
    <p>This link will expire in ${data.expiryHours ?? 1} hour(s).</p>
    <p>If you didn't request this, please ignore this email.</p>
  </div>
</body>
</html>`,
    });

    // Alert email template
    this.registerTemplate('alert', {
      subject: (data) => `[Alert] ${data.title ?? 'Important Notification'}`,
      text: (data) => 
`${data.title ?? 'Alert'}

${data.message ?? ''}

${data.details ? `Details: ${JSON.stringify(data.details, null, 2)}` : ''}

This is an automated alert from AlphaArena.`,
      html: (data) => 
`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h2>${data.title ?? 'Alert'}</h2>
    <div class="alert">
      <p>${data.message ?? ''}</p>
    </div>
    ${data.details ? `<pre>${JSON.stringify(data.details, null, 2)}</pre>` : ''}
    <p><small>This is an automated alert from AlphaArena.</small></p>
  </div>
</body>
</html>`,
    });

    // Report email template
    this.registerTemplate('report', {
      subject: (data) => `${data.reportName ?? 'Report'} - ${data.period ?? new Date().toLocaleDateString()}`,
      text: (data) => 
`${data.reportName ?? 'Report'}

Period: ${data.period ?? 'N/A'}

${data.summary ?? 'No summary available.'}

---
This report was generated automatically by AlphaArena.`,
      html: (data) => 
`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #667eea; color: white; padding: 20px; }
    .content { padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${data.reportName ?? 'Report'}</h2>
      <p>Period: ${data.period ?? 'N/A'}</p>
    </div>
    <div class="content">
      <p>${data.summary ?? 'No summary available.'}</p>
    </div>
    <p><small>Generated automatically by AlphaArena.</small></p>
  </div>
</body>
</html>`,
    });
  }
}

// Default instance for convenience
let defaultInstance: EmailService | null = null;

/**
 * Get the default EmailService instance
 */
export function getEmailService(config?: EmailServiceConfig): EmailService {
  if (!defaultInstance || config) {
    defaultInstance = new EmailService(config);
  }
  return defaultInstance;
}

/**
 * Reset the default EmailService instance
 * Useful for testing or reconfiguration
 */
export function resetEmailService(): void {
  defaultInstance = null;
}

export default EmailService;