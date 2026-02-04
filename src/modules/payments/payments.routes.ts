import { Router } from 'express';
import {
  initiateWalletTopupController,
  getPaymentStatusController,
} from './payments.controller.js';
import { authGuard } from '../../middlewares/auth_guard.js';

const router = Router();

// All routes require authentication
router.use(authGuard);

/**
 * POST /wallet/topup/initiate
 * Initiate wallet top-up
 */
router.post('/wallet/topup/initiate', initiateWalletTopupController);

/**
 * GET /payments/:paymentId
 * Get payment status
 */
router.get('/payments/:paymentId', getPaymentStatusController);

export default router;
