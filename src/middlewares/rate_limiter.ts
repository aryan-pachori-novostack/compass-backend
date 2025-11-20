import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

// General API rate limiter
export const api_rate_limiter = rateLimit({
  windowMs: env.rate_limit.api_window_ms,
  max: env.rate_limit.api_max_requests,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many requests from this IP, please try again later',
    code: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for auth endpoints
export const auth_rate_limiter = rateLimit({
  windowMs: env.rate_limit.auth_window_ms,
  max: env.rate_limit.auth_max_requests,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many login attempts, please try again later',
    code: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: env.rate_limit.auth_skip_successful,
});

export default { api_rate_limiter, auth_rate_limiter };

