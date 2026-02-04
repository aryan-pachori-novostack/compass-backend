import { type Response } from 'express';
import { getOrCreateWallet, listWalletTransactions } from './wallet.service.js';
import { authGuard, type AuthRequest } from '../../middlewares/auth_guard.js';
import logger from '../../utils/logger.js';

/**
 * Get Wallet
 * GET /wallet
 */
export async function getWalletController(req: AuthRequest, res: Response): Promise<void> {
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

    const wallet = await getOrCreateWallet(partnerId);

    res.status(200).json(wallet);
  } catch (error) {
    logger.error('Get wallet error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get wallet',
      code: 500,
    });
  }
}

/**
 * List Wallet Transactions
 * GET /wallet/transactions
 */
export async function listWalletTransactionsController(req: AuthRequest, res: Response): Promise<void> {
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

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const txnType = req.query.txn_type as string | undefined;

    const result = await listWalletTransactions(partnerId, txnType as any, page, limit);

    res.status(200).json(result);
  } catch (error) {
    logger.error('List wallet transactions error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to list wallet transactions',
      code: 500,
    });
  }
}
