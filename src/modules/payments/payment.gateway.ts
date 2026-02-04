import { env } from '../../config/env.js';
import logger from '../../utils/logger.js';

/**
 * Payment Gateway Interface
 */
export interface PaymentGateway {
  createPayment(params: {
    amount: number;
    currency: string;
    partnerId: string;
    purpose: 'WALLET_TOPUP' | 'ORDER_PAYMENT';
    referenceId: string;
    metadata?: any;
  }): Promise<{ gatewayTxnId: string; paymentUrl?: string }>;

  verifyWebhook(req: any): { ok: boolean; gatewayTxnId?: string; payload?: any };
}

/**
 * Payment Gateway Implementation (Stub/Mock)
 * In production, this would integrate with actual payment gateway (Razorpay, Stripe, etc.)
 */
class MockPaymentGateway implements PaymentGateway {
  async createPayment(params: {
    amount: number;
    currency: string;
    partnerId: string;
    purpose: 'WALLET_TOPUP' | 'ORDER_PAYMENT';
    referenceId: string;
    metadata?: any;
  }): Promise<{ gatewayTxnId: string; paymentUrl?: string }> {
    // Mock implementation - in production, call actual payment gateway API
    const gatewayTxnId = `gtw_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    logger.info('Payment gateway order created (mock)', {
      amount: params.amount,
      currency: params.currency,
      purpose: params.purpose,
      referenceId: params.referenceId,
      gatewayTxnId,
    });

    // In production, this would make HTTP request to payment gateway
    // For now, return mock gateway transaction ID and payment URL
    const result: { gatewayTxnId: string; paymentUrl?: string } = {
      gatewayTxnId,
    };

    if (process.env.NODE_ENV === 'development') {
      result.paymentUrl = `https://mock-gateway.com/pay/${gatewayTxnId}`;
    }

    return result;
  }

  verifyWebhook(req: any): { ok: boolean; gatewayTxnId?: string; payload?: any } {
    // Mock implementation - in production, verify signature from payment gateway
    // For now, check for API key in headers or body
    const apiKey = req.headers['x-payment-api-key'] || req.body?.api_key;
    
    if (env.ocr.api_key && apiKey === env.ocr.api_key) {
      // Extract gateway_txn_id from webhook payload
      const gatewayTxnId = req.body?.gateway_txn_id || req.body?.id || req.body?.transaction_id;
      return {
        ok: true,
        gatewayTxnId,
        payload: req.body,
      };
    }

    // In development, allow if no API key configured
    if (!env.ocr.api_key && process.env.NODE_ENV === 'development') {
      logger.warn('Payment webhook verification skipped in development mode');
      const gatewayTxnId = req.body?.gateway_txn_id || req.body?.id || req.body?.transaction_id;
      return {
        ok: true,
        gatewayTxnId,
        payload: req.body,
      };
    }

    logger.warn('Payment webhook verification failed', {
      hasApiKey: !!env.ocr.api_key,
      receivedKey: !!apiKey,
    });

    return { ok: false };
  }
}

// Export singleton instance
export const paymentGateway: PaymentGateway = new MockPaymentGateway();
