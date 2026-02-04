import { Router } from 'express';
import { getPartnerActivityFeedController } from './activity.controller.js';
import { authGuard } from '../../middlewares/auth_guard.js';

const router = Router();

// All routes require authentication
router.use(authGuard);

/**
 * GET /activity
 * Get partner activity feed
 */
router.get('/', getPartnerActivityFeedController as any);

export default router;
