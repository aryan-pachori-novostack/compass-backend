import { Router } from 'express';
import {
  getWalletController,
  listWalletTransactionsController,
} from './wallet.controller.js';
import { authGuard } from '../../middlewares/auth_guard.js';

const router = Router();

// All routes require authentication
router.use(authGuard);

/**
 * GET /wallet
 * Get wallet (create if missing)
 */
router.get('/', getWalletController);

/**
 * GET /wallet/transactions
 * List wallet transactions
 */
router.get('/transactions', listWalletTransactionsController);

export default router;
