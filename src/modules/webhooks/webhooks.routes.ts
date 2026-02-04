import { Router } from 'express';
import { handleOcrWebhook } from '../documents/documents.service.js';
import { handlePaymentWebhook } from '../payments/payments.service.js';
import { ocrProvider } from '../documents/ocr.provider.js';
import { paymentGateway } from '../payments/payment.gateway.js';
import logger from '../../utils/logger.js';

const router = Router();

/**
 * POST /webhooks/ocr
 * OCR provider webhook callback
 */
router.post('/ocr', async (req, res) => {
  try {
    // Verify webhook signature
    if (!ocrProvider.verifyWebhook(req)) {
      logger.warn('OCR webhook verification failed', {
        headers: req.headers,
        body: req.body,
      });
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Webhook verification failed',
        code: 401,
      });
      return;
    }

    // Extract webhook payload (abstract - adjust based on actual provider format)
    const { job_id, jobId, document_id, documentId, status, extracted_data, extractedData, error } = req.body;

    const jobIdValue = job_id || jobId;
    const documentIdValue = document_id || documentId;
    const statusValue = status?.toUpperCase();
    const extractedDataValue = extracted_data || extractedData;

    if (!jobIdValue) {
      logger.warn('OCR webhook missing job_id', { body: req.body });
      res.status(400).json({
        error: 'MISSING_JOB_ID',
        message: 'job_id is required',
        code: 400,
      });
      return;
    }

    if (!statusValue || (statusValue !== 'COMPLETED' && statusValue !== 'FAILED')) {
      logger.warn('OCR webhook invalid status', { status: statusValue });
      res.status(400).json({
        error: 'INVALID_STATUS',
        message: 'status must be COMPLETED or FAILED',
        code: 400,
      });
      return;
    }

    // Handle webhook (idempotent)
    const result = await handleOcrWebhook(
      jobIdValue,
      statusValue as 'COMPLETED' | 'FAILED',
      extractedDataValue,
      documentIdValue
    );

    // Always return 200 OK after verification
    res.status(200).json({
      success: true,
      processed: result.processed,
    });
  } catch (error) {
    logger.error('OCR webhook error:', { error });
    // Still return 200 to prevent provider retries
    res.status(200).json({
      success: false,
      error: 'PROCESSING_FAILED',
    });
  }
});

/**
 * POST /webhooks/payment
 * Payment gateway webhook callback
 */
router.post('/payment', async (req, res) => {
  try {
    // Verify webhook signature
    const verification = paymentGateway.verifyWebhook(req);
    
    if (!verification.ok) {
      logger.warn('Payment webhook verification failed', {
        headers: req.headers,
        body: req.body,
      });
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Webhook verification failed',
        code: 401,
      });
      return;
    }

    // Extract webhook payload (abstract - adjust based on actual provider format)
    const payload = verification.payload || req.body;
    const gatewayTxnId = verification.gatewayTxnId || payload?.gateway_txn_id || payload?.id || payload?.transaction_id;
    const status = payload?.status?.toUpperCase() || payload?.payment_status?.toUpperCase();
    const amount = payload?.amount || payload?.amount_paid || payload?.amount_captured;
    const currency = payload?.currency || payload?.currency_code || 'INR';

    if (!gatewayTxnId) {
      logger.warn('Payment webhook missing gateway_txn_id', { body: payload });
      res.status(400).json({
        error: 'MISSING_GATEWAY_TXN_ID',
        message: 'gateway_txn_id is required',
        code: 400,
      });
      return;
    }

    if (!status || (status !== 'SUCCESS' && status !== 'FAILED')) {
      logger.warn('Payment webhook invalid status', { status });
      res.status(400).json({
        error: 'INVALID_STATUS',
        message: 'status must be SUCCESS or FAILED',
        code: 400,
      });
      return;
    }

    if (!amount || typeof amount !== 'number') {
      logger.warn('Payment webhook invalid amount', { amount });
      res.status(400).json({
        error: 'INVALID_AMOUNT',
        message: 'Valid amount is required',
        code: 400,
      });
      return;
    }

    // Handle webhook (idempotent)
    const result = await handlePaymentWebhook(
      gatewayTxnId,
      status as 'SUCCESS' | 'FAILED',
      amount,
      currency
    );

    // Always return 200 OK after verification
    res.status(200).json({
      success: true,
      processed: result.processed,
    });
  } catch (error) {
    logger.error('Payment webhook error:', { error });
    
    // Still return 200 to prevent provider retries (after verification)
    // But log the error for investigation
    res.status(200).json({
      success: false,
      error: 'PROCESSING_FAILED',
    });
  }
});

export default router;
