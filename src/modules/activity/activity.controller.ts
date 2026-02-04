import { type Response } from 'express';
import { getPartnerActivityFeed } from './activity.service.js';
import { authGuard, type AuthRequest } from '../../middlewares/auth_guard.js';
import logger from '../../utils/logger.js';

/**
 * Get Partner Activity Feed
 * GET /activity
 */
export async function getPartnerActivityFeedController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const partnerId = req.partnerId;

    if (!partnerId) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner ID not found',
        code: 401,
      });
      return;
    }

    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const result = await getPartnerActivityFeed(partnerId, page, limit);

    res.status(200).json(result);
  } catch (error) {
    logger.error('Get activity feed error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get activity feed',
      code: 500,
    });
  }
}
