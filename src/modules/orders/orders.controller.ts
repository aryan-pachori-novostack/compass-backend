import { type Request, type Response } from 'express';
import {
  createOrder,
  listOrders,
  getOrderDetail,
  updateTravelDates,
  getCheckoutPreview,
  confirmCheckout,
  cancelOrder,
} from './orders.service.js';
import {
  createOrderSchema,
  updateTravelDatesSchema,
  confirmCheckoutSchema,
  listOrdersQuerySchema,
} from './orders.validator.js';
import { authGuard, type AuthRequest } from '../../middlewares/auth_guard.js';
import logger from '../../utils/logger.js';

/**
 * Create Order
 * POST /orders
 */
export async function createOrderController(req: AuthRequest, res: Response): Promise<void> {
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

    // Validate input
    const validated = createOrderSchema.parse(req.body);

    const result = await createOrder(partnerId, validated);

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'VISA_VARIANT_NOT_FOUND') {
        res.status(404).json({
          error: 'VISA_VARIANT_NOT_FOUND',
          message: 'Visa variant not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'VISA_VARIANT_INACTIVE') {
        res.status(400).json({
          error: 'VISA_VARIANT_INACTIVE',
          message: 'Visa variant is not active',
          code: 400,
        });
        return;
      }

      if (error.message === 'COUNTRY_PAUSED') {
        res.status(400).json({
          error: 'COUNTRY_PAUSED',
          message: 'Cannot create order for paused country',
          code: 400,
        });
        return;
      }

      if (error.message === 'ORDER_CODE_GENERATION_FAILED') {
        res.status(500).json({
          error: 'ORDER_CODE_GENERATION_FAILED',
          message: 'Failed to generate unique order code',
          code: 500,
        });
        return;
      }

      // Zod validation errors
      if (error.name === 'ZodError') {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          code: 400,
          details: error.message,
        });
        return;
      }
    }

    logger.error('Create order error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create order',
      code: 500,
    });
  }
}

/**
 * List Orders
 * GET /orders
 */
export async function listOrdersController(req: AuthRequest, res: Response): Promise<void> {
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

    // Validate and parse query params
    const query = listOrdersQuerySchema.parse(req.query);

    const result = await listOrders(partnerId, query.status, query.page, query.limit);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      // Zod validation errors
      if (error.name === 'ZodError') {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          code: 400,
          details: error.message,
        });
        return;
      }
    }

    logger.error('List orders error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to list orders',
      code: 500,
    });
  }
}

/**
 * Get Order Detail
 * GET /orders/:orderId
 */
export async function getOrderDetailController(req: AuthRequest, res: Response): Promise<void> {
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

    const result = await getOrderDetail(orderId, partnerId);

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
    }

    logger.error('Get order detail error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get order detail',
      code: 500,
    });
  }
}

/**
 * Update Travel Dates
 * PUT /orders/:orderId/travel-dates
 */
export async function updateTravelDatesController(req: AuthRequest, res: Response): Promise<void> {
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

    // Validate input
    const validated = updateTravelDatesSchema.parse(req.body);

    const result = await updateTravelDates(orderId, partnerId, validated);

    res.status(200).json({
      success: true,
      ...result,
    });
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

      // Zod validation errors
      if (error.name === 'ZodError') {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          code: 400,
          details: error.message,
        });
        return;
      }
    }

    logger.error('Update travel dates error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update travel dates',
      code: 500,
    });
  }
}

/**
 * Checkout Preview
 * GET /orders/:orderId/checkout/preview
 */
export async function getCheckoutPreviewController(req: AuthRequest, res: Response): Promise<void> {
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

    const result = await getCheckoutPreview(orderId, partnerId);

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

      if (error.message === 'PARTNER_NOT_FOUND') {
        res.status(404).json({
          error: 'PARTNER_NOT_FOUND',
          message: 'Partner not found',
          code: 404,
        });
        return;
      }
    }

    logger.error('Get checkout preview error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get checkout preview',
      code: 500,
    });
  }
}

/**
 * Confirm Checkout
 * POST /orders/:orderId/checkout/confirm
 */
export async function confirmCheckoutController(req: AuthRequest, res: Response): Promise<void> {
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

    // Validate input
    const validated = confirmCheckoutSchema.parse(req.body);

    const result = await confirmCheckout(orderId, partnerId, validated);

    res.status(200).json({
      success: true,
      ...result,
    });
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

      if (error.message === 'PROFILE_INCOMPLETE') {
        res.status(400).json({
          error: 'PROFILE_INCOMPLETE',
          message: 'Profile must be at least 80% complete',
          code: 400,
        });
        return;
      }

      if (error.message === 'KYC_NOT_READY') {
        res.status(400).json({
          error: 'KYC_NOT_READY',
          message: 'KYC must be SUBMITTED or VERIFIED',
          code: 400,
        });
        return;
      }

      if (error.message === 'COUNTRY_PAUSED') {
        res.status(400).json({
          error: 'COUNTRY_PAUSED',
          message: 'Cannot checkout order for paused country',
          code: 400,
        });
        return;
      }

      if (error.message === 'NO_APPLICATIONS') {
        res.status(400).json({
          error: 'NO_APPLICATIONS',
          message: 'Order must have at least one application',
          code: 400,
        });
        return;
      }

      // Zod validation errors
      if (error.name === 'ZodError') {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          code: 400,
          details: error.message,
        });
        return;
      }
    }

    logger.error('Confirm checkout error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to confirm checkout',
      code: 500,
    });
  }
}

/**
 * Cancel Order
 * POST /orders/:orderId/cancel
 */
export async function cancelOrderController(req: AuthRequest, res: Response): Promise<void> {
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

    const result = await cancelOrder(orderId, partnerId);

    res.status(200).json({
      success: true,
      ...result,
    });
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

      if (error.message === 'ORDER_CANNOT_BE_CANCELLED') {
        res.status(400).json({
          error: 'ORDER_CANNOT_BE_CANCELLED',
          message: 'Order cannot be cancelled in current status',
          code: 400,
        });
        return;
      }
    }

    logger.error('Cancel order error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to cancel order',
      code: 500,
    });
  }
}
