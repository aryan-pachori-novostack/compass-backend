import { type Request, type Response } from 'express';
import { requestOtp, verifyOtp, getCurrentPartner } from './auth.service.js';
import { requestOtpSchema, verifyOtpSchema } from './auth.validator.js';
import { authGuard, type AuthRequest } from '../../middlewares/auth_guard.js';
import logger from '../../utils/logger.js';

/**
 * Request OTP Controller
 * POST /auth/request-otp
 */
export async function requestOtpController(req: Request, res: Response): Promise<void> {
  try {
    // Validate input
    const validated = requestOtpSchema.parse(req.body);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    // Request OTP
    const result = await requestOtp(validated, clientIp);

    res.status(200).json({
      success: true,
      expires_in: result.expires_in,
    });
  } catch (error) {
    if (error instanceof Error) {
      // Handle known errors
      if (error.message === 'PARTNER_NOT_FOUND') {
        res.status(404).json({
          error: 'PARTNER_NOT_FOUND',
          message: 'No account found with this identifier. Please sign up first.',
          code: 404,
        });
        return;
      }

      // Zod validation errors
      if (error.name === 'ZodError') {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          code: 400,
          details: error.message,
        });
        return;
      }
    }

    logger.error('Request OTP error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to request OTP',
      code: 500,
    });
  }
}

/**
 * Verify OTP Controller
 * POST /auth/verify-otp
 */
export async function verifyOtpController(req: Request, res: Response): Promise<void> {
  try {
    // Validate input
    const validated = verifyOtpSchema.parse(req.body);

    // Verify OTP
    const result = await verifyOtp(validated);

    res.status(200).json({
      success: true,
      token: result.token,
      partner: result.partner,
    });
  } catch (error) {
    if (error instanceof Error) {
      // Handle known errors
      if (error.message === 'OTP_NOT_FOUND_OR_EXPIRED') {
        res.status(400).json({
          error: 'OTP_NOT_FOUND_OR_EXPIRED',
          message: 'OTP not found or has expired. Please request a new OTP.',
          code: 400,
        });
        return;
      }

      if (error.message === 'INVALID_OTP') {
        res.status(400).json({
          error: 'INVALID_OTP',
          message: 'Invalid OTP. Please check and try again.',
          code: 400,
        });
        return;
      }

      if (error.message === 'OTP_ALREADY_VERIFIED') {
        res.status(400).json({
          error: 'OTP_ALREADY_VERIFIED',
          message: 'This OTP has already been used. Please request a new OTP.',
          code: 400,
        });
        return;
      }

      // Zod validation errors
      if (error.name === 'ZodError') {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          code: 400,
          details: error.message,
        });
        return;
      }
    }

    logger.error('Verify OTP error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to verify OTP',
      code: 500,
    });
  }
}

/**
 * Get Current Session Controller
 * GET /auth/me
 */
export async function getMeController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const partnerId = req.partnerId;

    if (!partnerId) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner ID not found in token',
        code: 401,
      });
      return;
    }

    const partner = await getCurrentPartner(partnerId);

    res.status(200).json({
      success: true,
      id: partner.id,
      email: partner.email,
      phone: partner.phone,
      partner_type: partner.partner_type,
      kyc_status: partner.kyc_status,
      profile_pct: partner.profile_pct,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'PARTNER_NOT_FOUND') {
        res.status(404).json({
          error: 'PARTNER_NOT_FOUND',
          message: 'Partner account not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'PARTNER_INACTIVE') {
        res.status(403).json({
          error: 'PARTNER_INACTIVE',
          message: 'Partner account is inactive',
          code: 403,
        });
        return;
      }
    }

    logger.error('Get me error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get partner information',
      code: 500,
    });
  }
}

/**
 * Logout Controller
 * POST /auth/logout
 */
export async function logoutController(req: Request, res: Response): Promise<void> {
  // Stateless JWT logout - just return success
  // Future: Could implement token blacklist here
  res.status(200).json({
    success: true,
  });
}
