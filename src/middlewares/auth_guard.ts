import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

export interface AuthRequest extends Request {
  partner_account_id?: string;
  email?: string;
  partner_type?: string;
}

export const auth_guard = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const auth_header = req.headers.authorization;

    if (!auth_header || !auth_header.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authorization header with Bearer token is required',
        code: 401,
      });
      return;
    }

    const token = auth_header.substring(7); // Remove 'Bearer ' prefix

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
        partner_account_id: string;
        email: string;
        partner_type: string;
      };

      // Attach decoded info to request object
      req.partner_account_id = decoded.partner_account_id;
      req.email = decoded.email;
      req.partner_type = decoded.partner_type;

      next();
    } catch (jwt_error) {
      logger.warn('Invalid JWT token:', { error: jwt_error instanceof Error ? jwt_error.message : 'Unknown' });
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
        code: 401,
      });
      return;
    }
  } catch (error) {
    logger.error('Auth guard error:', { error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Authentication check failed',
      code: 500,
    });
    return;
  }
};

export default auth_guard;

