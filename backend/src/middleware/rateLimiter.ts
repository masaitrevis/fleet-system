import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting (consider Redis for production)
const store: RateLimitStore = {};

interface RateLimitOptions {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
  message?: string;
}

const defaultOptions: RateLimitOptions = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: 'Too many requests, please try again later'
};

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 60 * 1000); // Clean every minute

export const rateLimiter = (options: Partial<RateLimitOptions> = {}) => {
  const opts = { ...defaultOptions, ...options };
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Get identifier (API key, user ID, or IP)
    const identifier = 
      req.headers['x-api-key']?.toString() ||
      (req as any).user?.userId ||
      req.ip ||
      'unknown';
    
    const key = `${req.path}:${identifier}`;
    const now = Date.now();
    
    // Initialize or get existing entry
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 0,
        resetTime: now + opts.windowMs
      };
    }
    
    // Increment count
    store[key].count++;
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', opts.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, opts.maxRequests - store[key].count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(store[key].resetTime).toISOString());
    
    // Check if limit exceeded
    if (store[key].count > opts.maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: opts.message,
        retryAfter: Math.ceil((store[key].resetTime - now) / 1000)
      });
    }
    
    next();
  };
};

// Stricter rate limiter for auth endpoints
export const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later'
});

// API key rate limiter (higher limits)
export const apiKeyRateLimiter = (maxRequests: number = 1000) => rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests
});
