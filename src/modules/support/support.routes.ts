import { Router } from 'express';
import {
  createSupportTicketController,
  listPartnerTicketsController,
  getTicketDetailController,
} from './support.controller.js';
import { authGuard } from '../../middlewares/auth_guard.js';

const router = Router();

// All routes require authentication
router.use(authGuard);

/**
 * POST /support/tickets
 * Create support ticket
 */
router.post('/tickets', createSupportTicketController as any);

/**
 * GET /support/tickets
 * List partner tickets
 */
router.get('/tickets', listPartnerTicketsController as any);

/**
 * GET /support/tickets/:ticketId
 * Get ticket detail
 */
router.get('/tickets/:ticketId', getTicketDetailController as any);

export default router;
