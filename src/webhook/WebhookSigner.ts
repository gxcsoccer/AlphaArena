/**
 * WebhookSigner - HMAC-SHA256 signature generation and verification
 *
 * Provides secure signing for webhook payloads to ensure authenticity
 */

import * as crypto from 'crypto';
import { WebhookPayload } from './types';

/**
 * WebhookSigner class for signing and verifying webhook payloads
 */
export class WebhookSigner {
  private secret: string;

  constructor(secret: string) {
    if (!secret || secret.length < 16) {
      throw new Error('Secret must be at least 16 characters long');
    }
    this.secret = secret;
  }

  /**
   * Generate HMAC-SHA256 signature for a payload
   * @param payload - The webhook payload to sign
   * @returns Signature string in format "sha256=<hex>"
   */
  sign(payload: WebhookPayload): string {
    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', this.secret);
    hmac.update(payloadString);
    const signature = hmac.digest('hex');
    return `sha256=${signature}`;
  }

  /**
   * Sign raw data string
   * @param data - Raw data string to sign
   * @returns Signature string in format "sha256=<hex>"
   */
  signRaw(data: string): string {
    const hmac = crypto.createHmac('sha256', this.secret);
    hmac.update(data);
    const signature = hmac.digest('hex');
    return `sha256=${signature}`;
  }

  /**
   * Verify a signature against a payload
   * @param payload - The webhook payload to verify
   * @param signature - The signature to verify against
   * @returns True if signature is valid
   */
  verify(payload: WebhookPayload, signature: string): boolean {
    const expectedSignature = this.sign(payload);
    return this.safeCompare(signature, expectedSignature);
  }

  /**
   * Verify raw data against a signature
   * @param data - Raw data string to verify
   * @param signature - The signature to verify against
   * @returns True if signature is valid
   */
  verifyRaw(data: string, signature: string): boolean {
    const expectedSignature = this.signRaw(data);
    return this.safeCompare(signature, expectedSignature);
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   * @param a - First string
   * @param b - Second string
   * @returns True if strings are equal
   */
  private safeCompare(a: string, b: string): boolean {
    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }

  /**
   * Generate a random secret for webhook signing
   * @param length - Length of the secret (default: 32)
   * @returns Random hex string
   */
  static generateSecret(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Extract signature from header value
   * @param headerValue - The signature header value
   * @returns The signature hex string or null if invalid format
   */
  static extractSignature(headerValue: string): string | null {
    if (!headerValue) return null;
    
    const match = headerValue.match(/^sha256=([a-fA-F0-9]+)$/);
    return match ? match[1] : null;
  }

  /**
   * Create a signature header value
   * @param signatureHex - The hex signature
   * @returns Signature string in format "sha256=<hex>"
   */
  static formatSignature(signatureHex: string): string {
    return `sha256=${signatureHex}`;
  }
}

export default WebhookSigner;
