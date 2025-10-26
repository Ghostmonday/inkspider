// Security Utilities for DirectorStudio
// HMAC verification, signature generation, and request security

import crypto from 'crypto';

/**
 * Generate HMAC-SHA256 signature for payload
 * @param payload - The data to sign (will be JSON stringified if object)
 * @param secret - The signing secret
 * @returns Hex-encoded signature
 */
export function generateHmacSignature(
  payload: string | Record<string, any>,
  secret: string
): string {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  
  return crypto
    .createHmac('sha256', secret)
    .update(data, 'utf8')
    .digest('hex');
}

/**
 * Verify HMAC signature using constant-time comparison
 * @param payload - The data that was signed
 * @param signature - The signature to verify
 * @param secret - The signing secret
 * @returns true if signature is valid
 */
export function verifyHmacSignature(
  payload: string | Record<string, any>,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }
  
  const expectedSignature = generateHmacSignature(payload, secret);
  
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Extract IP address from request headers
 * Handles various proxy headers safely
 * @param headers - Next.js request headers
 * @returns IP address or 'unknown'
 */
export function sanitizeIpAddress(headers: Headers): string {
  // Check various common proxy headers in order of preference
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take first IP if multiple are present
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  
  const cfConnectingIp = headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }
  
  return 'unknown';
}

/**
 * Extract user agent from request headers
 * @param headers - Next.js request headers
 * @returns User agent string or 'unknown'
 */
export function getUserAgent(headers: Headers): string {
  return headers.get('user-agent') || 'unknown';
}

/**
 * Generate a unique request ID for tracking
 * @returns UUID v4 request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Validate environment variables are set
 * @throws Error if required variables are missing
 */
export function validateSecurityEnv(): void {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'APP_UPLOAD_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

/**
 * Constant-time string comparison
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(a, 'utf8'),
      Buffer.from(b, 'utf8')
    );
  } catch {
    return false;
  }
}

/**
 * Rate limiting helper - simple in-memory implementation
 * For production, use Redis or similar
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number = 100,
  windowMs: number = 60 * 60 * 1000 // 1 hour
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  // Clean up expired entries
  if (record && record.resetAt < now) {
    rateLimitStore.delete(key);
  }
  
  if (!record || record.resetAt < now) {
    // Create new window
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }
  
  // Increment existing window
  record.count++;
  
  if (record.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }
  
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetAt: record.resetAt
  };
}

/**
 * Sanitize filename for safe storage
 * @param filename - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  const base = filename.replace(/^.*[\\\/]/, '');
  
  // Replace unsafe characters
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Generate a secure random token
 * @param length - Length of token in bytes (default 32)
 * @returns Hex-encoded random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a value using SHA-256
 * @param value - Value to hash
 * @returns Hex-encoded hash
 */
export function sha256Hash(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Verify that a request is from a trusted source
 * @param headers - Request headers
 * @param secret - Shared secret
 * @returns true if request is verified
 */
export function verifyTrustedRequest(headers: Headers, secret: string): boolean {
  const signature = headers.get('x-client-signature');
  const timestamp = headers.get('x-timestamp');
  const challenge = headers.get('x-challenge');
  
  if (!signature || !timestamp || !challenge) {
    return false;
  }
  
  // Check timestamp is within 5 minutes
  const now = Date.now();
  const requestTime = parseInt(timestamp, 10);
  if (isNaN(requestTime) || Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return false;
  }
  
  // Verify signature
  const expectedSignature = generateHmacSignature(
    `${timestamp}:${challenge}`,
    secret
  );
  
  return constantTimeEqual(signature, expectedSignature);
}
