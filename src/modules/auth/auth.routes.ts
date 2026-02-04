import { Router } from 'express';
import {
  requestOtpController,
  verifyOtpController,
  getMeController,
  logoutController,
} from './auth.controller.js';
import { authGuard } from '../../middlewares/auth_guard.js';
import { auth_rate_limiter } from '../../middlewares/rate_limiter.js';

const router = Router();

/**
 * POST /auth/request-otp
 * Request OTP for signup or login
 */
router.post('/request-otp', auth_rate_limiter, requestOtpController);

/**
 * POST /auth/verify-otp
 * Verify OTP and get JWT token
 */
router.post('/verify-otp', auth_rate_limiter, verifyOtpController);

/**
 * GET /auth/me
 * Get current authenticated partner information
 */
router.get('/me', authGuard, getMeController);

/**
 * POST /auth/logout
 * Logout (stateless - just returns success)
 */
router.post('/logout', authGuard, logoutController);

export default router;
