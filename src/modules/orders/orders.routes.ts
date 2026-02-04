import { Router } from 'express';
import {
  createOrderController,
  listOrdersController,
  getOrderDetailController,
  updateTravelDatesController,
  getCheckoutPreviewController,
  confirmCheckoutController,
  cancelOrderController,
} from './orders.controller.js';
import { payOrderController } from '../payments/payments.controller.js';
import { authGuard } from '../../middlewares/auth_guard.js';

const router = Router();

// All routes require authentication
router.use(authGuard);

/**
 * POST /orders
 * Create a new order
 */
router.post('/', createOrderController);

/**
 * GET /orders
 * List orders for the authenticated partner
 */
router.get('/', listOrdersController);

/**
 * GET /orders/:orderId
 * Get order detail with readiness
 */
router.get('/:orderId', getOrderDetailController);

/**
 * PUT /orders/:orderId/travel-dates
 * Update travel dates
 */
router.put('/:orderId/travel-dates', updateTravelDatesController);

/**
 * GET /orders/:orderId/checkout/preview
 * Get checkout preview (no payment)
 */
router.get('/:orderId/checkout/preview', getCheckoutPreviewController);

/**
 * POST /orders/:orderId/checkout/confirm
 * Confirm checkout (store snapshot, no payment)
 */
router.post('/:orderId/checkout/confirm', confirmCheckoutController);

/**
 * POST /orders/:orderId/cancel
 * Cancel order
 */
router.post('/:orderId/cancel', cancelOrderController);

/**
 * POST /orders/:orderId/pay
 * Pay order (wallet-first)
 */
router.post('/:orderId/pay', payOrderController);

export default router;
