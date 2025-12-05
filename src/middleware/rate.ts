import rateLimit from 'express-rate-limit';

/**
 * Global rate limiter
 * Limits all requests to 120 per 15 minutes per IP
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120, // 120 requests per window
  // Allowlist health checks so status pages don't burn the quota
  skip: (req) => req.path === '/healthz',
  message: {
    error: 'Too Many Requests',
    message: 'Global rate limit exceeded. Please try again later.',
  },
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Global rate limit exceeded. Please try again later.',
    });
  },
});

/**
 * Per-IP rate limiter for account operations
 * Limits account creation/claiming to 30 requests per 15 minutes per IP
 * More strict than global limit to prevent abuse
 */
export const accountOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window per IP
  message: {
    error: 'Too Many Requests',
    message: 'Account operations rate limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests, even successful ones
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Account operations rate limit exceeded. Please try again later.',
    });
  },
});
