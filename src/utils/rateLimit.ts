// Rate Limiting Middleware for SpiderInk.art
// This module provides comprehensive rate limiting for API endpoints

import { NextApiRequest, NextApiResponse } from 'next'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (req: NextApiRequest) => string
  onLimitReached?: (req: NextApiRequest, res: NextApiResponse) => void
}

interface RateLimitEntry {
  count: number
  resetTime: number
  blocked: boolean
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map()
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req) => req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || 'unknown',
      ...config
    }

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000)
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key)
      }
    }
  }

  private getKey(req: NextApiRequest): string {
    return this.config.keyGenerator!(req)
  }

  private getEntry(key: string): RateLimitEntry {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || entry.resetTime < now) {
      return {
        count: 0,
        resetTime: now + this.config.windowMs,
        blocked: false
      }
    }

    return entry
  }

  private setEntry(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry)
  }

  isAllowed(req: NextApiRequest): { allowed: boolean; remaining: number; resetTime: number } {
    const key = this.getKey(req)
    const entry = this.getEntry(key)

    if (entry.blocked) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime
      }
    }

    const remaining = Math.max(0, this.config.maxRequests - entry.count)
    const allowed = entry.count < this.config.maxRequests

    return {
      allowed,
      remaining,
      resetTime: entry.resetTime
    }
  }

  recordRequest(req: NextApiRequest, res: NextApiResponse): void {
    const key = this.getKey(req)
    const entry = this.getEntry(key)

    // Skip recording based on configuration
    if (this.config.skipSuccessfulRequests && res.statusCode < 400) {
      return
    }

    if (this.config.skipFailedRequests && res.statusCode >= 400) {
      return
    }

    entry.count++

    // Block if limit exceeded
    if (entry.count >= this.config.maxRequests) {
      entry.blocked = true
      if (this.config.onLimitReached) {
        this.config.onLimitReached(req, res)
      }
    }

    this.setEntry(key, entry)
  }

  reset(key: string): void {
    this.store.delete(key)
  }

  getStats(): { totalKeys: number; blockedKeys: number } {
    let blockedKeys = 0
    for (const entry of this.store.values()) {
      if (entry.blocked) {
        blockedKeys++
      }
    }

    return {
      totalKeys: this.store.size,
      blockedKeys
    }
  }
}

// Global rate limiters for different endpoints
const rateLimiters = {
  // General API rate limiter
  general: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    keyGenerator: (req) => {
      const ip = req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || 'unknown'
      const userId = req.headers['x-user-id'] as string
      return userId ? `user:${userId}` : `ip:${ip}`
    }
  }),

  // Strict rate limiter for auth endpoints
  auth: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyGenerator: (req) => {
      const ip = req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || 'unknown'
      return `auth:${ip}`
    }
  }),

  // Upload rate limiter
  upload: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    keyGenerator: (req) => {
      const ip = req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || 'unknown'
      return `upload:${ip}`
    }
  }),

  // DirectorStudio export rate limiter
  export: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20,
    keyGenerator: (req) => {
      const ip = req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || 'unknown'
      return `export:${ip}`
    }
  }),

  // Reconciliation rate limiter (admin only)
  reconciliation: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    keyGenerator: (req) => {
      const ip = req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || 'unknown'
      return `reconciliation:${ip}`
    }
  })
}

// Rate limiting middleware factory
export function createRateLimit(config: RateLimitConfig) {
  const limiter = new RateLimiter(config)

  return (req: NextApiRequest, res: NextApiResponse, next?: () => void) => {
    const { allowed, remaining, resetTime } = limiter.isAllowed(req)

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests)
    res.setHeader('X-RateLimit-Remaining', remaining)
    res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString())

    if (!allowed) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil((resetTime - Date.now()) / 1000)
      })
      return
    }

    // Record the request
    limiter.recordRequest(req, res)

    if (next) {
      next()
    }
  }
}

// Pre-configured rate limiters
export const rateLimit = {
  // General API rate limiting
  general: createRateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
    keyGenerator: (req) => {
      const ip = req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || 'unknown'
      const userId = req.headers['x-user-id'] as string
      return userId ? `user:${userId}` : `ip:${ip}`
    }
  }),

  // Authentication rate limiting
  auth: createRateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    keyGenerator: (req) => {
      const ip = req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || 'unknown'
      return `auth:${ip}`
    }
  }),

  // Upload rate limiting
  upload: createRateLimit({
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    keyGenerator: (req) => {
      const ip = req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || 'unknown'
      return `upload:${ip}`
    }
  }),

  // DirectorStudio export rate limiting
  export: createRateLimit({
    windowMs: 60 * 60 * 1000,
    maxRequests: 20,
    keyGenerator: (req) => {
      const ip = req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || 'unknown'
      return `export:${ip}`
    }
  }),

  // Admin operations rate limiting
  admin: createRateLimit({
    windowMs: 60 * 60 * 1000,
    maxRequests: 50,
    keyGenerator: (req) => {
      const ip = req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || 'unknown'
      return `admin:${ip}`
    }
  })
}

// Rate limiting for specific endpoints
export const endpointRateLimits = {
  '/api/auth/login': rateLimit.auth,
  '/api/auth/register': rateLimit.auth,
  '/api/auth/reset-password': rateLimit.auth,
  '/api/upload/presign': rateLimit.upload,
  '/api/upload/complete': rateLimit.upload,
  '/api/directostudio/export': rateLimit.export,
  '/api/reconciliation/run': rateLimit.admin,
  '/api/admin/*': rateLimit.admin
}

// Apply rate limiting to API routes
export function applyRateLimit(req: NextApiRequest, res: NextApiResponse, endpoint: string): boolean {
  const limiter = endpointRateLimits[endpoint] || rateLimit.general
  
  try {
    limiter(req, res)
    return true
  } catch (error) {
    console.error('Rate limiting error:', error)
    return false
  }
}

// Rate limit status endpoint
export async function rateLimitStatus(req: NextApiRequest, res: NextApiResponse) {
  try {
    const stats = Object.entries(rateLimiters).reduce((acc, [name, limiter]) => {
      acc[name] = limiter.getStats()
      return acc
    }, {} as Record<string, { totalKeys: number; blockedKeys: number }>)

    res.status(200).json({
      timestamp: new Date().toISOString(),
      rateLimits: stats,
      config: {
        general: { windowMs: 15 * 60 * 1000, maxRequests: 100 },
        auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
        upload: { windowMs: 60 * 60 * 1000, maxRequests: 10 },
        export: { windowMs: 60 * 60 * 1000, maxRequests: 20 },
        reconciliation: { windowMs: 60 * 60 * 1000, maxRequests: 10 }
      }
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve rate limit status',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Reset rate limits for a specific key
export function resetRateLimit(key: string, limiterName?: string): void {
  if (limiterName && rateLimiters[limiterName as keyof typeof rateLimiters]) {
    rateLimiters[limiterName as keyof typeof rateLimiters].reset(key)
  } else {
    // Reset for all limiters
    Object.values(rateLimiters).forEach(limiter => limiter.reset(key))
  }
}

// Rate limit bypass for trusted sources
export function isTrustedSource(req: NextApiRequest): boolean {
  const trustedIPs = [
    '127.0.0.1',
    '::1',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16'
  ]

  const clientIP = req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || ''
  
  return trustedIPs.some(trustedIP => {
    if (trustedIP.includes('/')) {
      // CIDR notation - simplified check
      return clientIP.startsWith(trustedIP.split('/')[0].split('.').slice(0, 2).join('.'))
    }
    return clientIP === trustedIP
  })
}

// Dynamic rate limiting based on user tier
export function getUserRateLimit(userTier: 'free' | 'premium' | 'enterprise'): RateLimitConfig {
  const baseConfig = {
    windowMs: 15 * 60 * 1000,
    keyGenerator: (req: NextApiRequest) => {
      const ip = req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || 'unknown'
      return `tier:${userTier}:${ip}`
    }
  }

  switch (userTier) {
    case 'free':
      return { ...baseConfig, maxRequests: 50 }
    case 'premium':
      return { ...baseConfig, maxRequests: 200 }
    case 'enterprise':
      return { ...baseConfig, maxRequests: 1000 }
    default:
      return { ...baseConfig, maxRequests: 50 }
  }
}

export default {
  rateLimit,
  endpointRateLimits,
  applyRateLimit,
  rateLimitStatus,
  resetRateLimit,
  isTrustedSource,
  getUserRateLimit
}
