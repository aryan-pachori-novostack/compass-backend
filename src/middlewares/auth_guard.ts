import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

export interface AuthRequest extends Request {
  partnerId?: string;
  role?: string;
}

/**
 * JWT Authentication Guard Middleware
 */
export const authGuard = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authorization header with Bearer token is required',
        code: 401,
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Token is required',
        code: 401,
      });
      return;
    }

    try {
      const decoded = jwt.verify(token, env.jwt_secret) as {
        partnerId: string;
        role: string;
      };

      // Validate role
      if (decoded.role !== 'PARTNER') {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Invalid role',
          code: 403,
        });
        return;
      }

      // Attach decoded info to request object
      req.partnerId = decoded.partnerId;
      req.role = decoded.role;

      next();
    } catch (jwtError) {
      logger.warn('Invalid JWT token:', {
        error: jwtError instanceof Error ? jwtError.message : 'Unknown',
      });
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
        code: 401,
      });
      return;
    }
  } catch (error) {
    logger.error('Auth guard error:', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Authentication check failed',
      code: 500,
    });
    return;
  }
};

export default authGuard;
