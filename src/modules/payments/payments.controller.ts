import { type Response } from 'express';
import {
  initiateWalletTopup,
  getPaymentStatus,
  payOrder,
} from './payments.service.js';
import { authGuard, type AuthRequest } from '../../middlewares/auth_guard.js';
import logger from '../../utils/logger.js';

/**
 * Initiate Wallet Top-up
 * POST /wallet/topup/initiate
 */
export async function initiateWalletTopupController(req: AuthRequest, res: Response): Promise<void> {
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

    const { amount, method } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({
        error: 'INVALID_AMOUNT',
        message: 'Valid amount is required',
        code: 400,
      });
      return;
    }

    if (!method) {
      res.status(400).json({
        error: 'PAYMENT_METHOD_REQUIRED',
        message: 'Payment method is required',
        code: 400,
      });
      return;
    }

    const result = await initiateWalletTopup(partnerId, amount, method);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'AMOUNT_TOO_LOW') {
        res.status(400).json({
          error: 'AMOUNT_TOO_LOW',
          message: 'Minimum amount is 10',
          code: 400,
        });
        return;
      }

      if (error.message === 'GATEWAY_ERROR') {
        res.status(500).json({
          error: 'GATEWAY_ERROR',
          message: 'Payment gateway error',
          code: 500,
        });
        return;
      }
    }

    logger.error('Initiate wallet topup error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to initiate wallet top-up',
      code: 500,
    });
  }
}

/**
 * Get Payment Status
 * GET /payments/:paymentId
 */
export async function getPaymentStatusController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const partnerId = req.partnerId;
    const paymentId = req.params.paymentId;

    if (!partnerId) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner ID not found',
        code: 401,
      });
      return;
    }

    if (!paymentId) {
      res.status(400).json({
        error: 'PAYMENT_ID_REQUIRED',
        message: 'Payment ID is required',
        code: 400,
      });
      return;
    }

    const payment = await getPaymentStatus(paymentId, partnerId);

    res.status(200).json(payment);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'PAYMENT_NOT_FOUND') {
        res.status(404).json({
          error: 'PAYMENT_NOT_FOUND',
          message: 'Payment not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'PAYMENT_ACCESS_DENIED') {
        res.status(403).json({
          error: 'PAYMENT_ACCESS_DENIED',
          message: 'Access denied to this payment',
          code: 403,
        });
        return;
      }
    }

    logger.error('Get payment status error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get payment status',
      code: 500,
    });
  }
}

/**
 * Pay Order
 * POST /orders/:orderId/pay
 */
export async function payOrderController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const partnerId = req.partnerId;
    const orderId = req.params.orderId;

    if (!partnerId) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner ID not found',
        code: 401,
      });
      return;
    }

    if (!orderId) {
      res.status(400).json({
        error: 'ORDER_ID_REQUIRED',
        message: 'Order ID is required',
        code: 400,
      });
      return;
    }

    const { use_wallet = true } = req.body;

    const result = await payOrder(orderId, partnerId, use_wallet);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'ORDER_NOT_FOUND') {
        res.status(404).json({
          error: 'ORDER_NOT_FOUND',
          message: 'Order not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'ORDER_ACCESS_DENIED') {
        res.status(403).json({
          error: 'ORDER_ACCESS_DENIED',
          message: 'Access denied to this order',
          code: 403,
        });
        return;
      }

      if (error.message === 'ORDER_NOT_READY') {
        res.status(400).json({
          error: 'ORDER_NOT_READY',
          message: 'Order is not ready for payment',
          code: 400,
        });
        return;
      }

      if (error.message === 'ORDER_FEE_NOT_SET') {
        res.status(400).json({
          error: 'ORDER_FEE_NOT_SET',
          message: 'Order fee is not set',
          code: 400,
        });
        return;
      }

      if (error.message === 'WALLET_NOT_FOUND') {
        res.status(404).json({
          error: 'WALLET_NOT_FOUND',
          message: 'Wallet not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'INSUFFICIENT_BALANCE') {
        res.status(400).json({
          error: 'INSUFFICIENT_BALANCE',
          message: 'Insufficient wallet balance',
          code: 400,
        });
        return;
      }

      if (error.message === 'GATEWAY_ERROR') {
        res.status(500).json({
          error: 'GATEWAY_ERROR',
          message: 'Payment gateway error',
          code: 500,
        });
        return;
      }
    }

    logger.error('Pay order error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to process order payment',
      code: 500,
    });
  }
}
