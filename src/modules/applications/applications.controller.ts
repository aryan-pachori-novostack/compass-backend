import { type Request, type Response } from 'express';
import {
  createApplication,
  listApplications,
  getApplicationDetail,
  updateApplication,
  setPrimaryApplicant,
  deleteApplication,
  getApplicationSummary,
} from './applications.service.js';
import { applicationSchema, type ApplicationInput } from './applications.validator.js';
import { authGuard, type AuthRequest } from '../../middlewares/auth_guard.js';
import logger from '../../utils/logger.js';

/**
 * Create Application (Add Traveller)
 * POST /orders/:orderId/applications
 */
export async function createApplicationController(req: AuthRequest, res: Response): Promise<void> {
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
    const validated = applicationSchema.parse(req.body);

    const result = await createApplication(orderId, partnerId, validated);

    res.status(201).json(result);
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

      if (error.message === 'ORDER_NOT_EDITABLE') {
        res.status(400).json({
          error: 'ORDER_NOT_EDITABLE',
          message: 'Order cannot be edited in current status',
          code: 400,
        });
        return;
      }

      if (error.message === 'INDIVIDUAL_ORDER_LIMIT') {
        res.status(400).json({
          error: 'INDIVIDUAL_ORDER_LIMIT',
          message: 'Individual orders can only have one application',
          code: 400,
        });
        return;
      }

      if (error.message === 'PASSPORT_EXPIRY_INVALID') {
        res.status(400).json({
          error: 'PASSPORT_EXPIRY_INVALID',
          message: 'Passport expiry date must be after travel end date',
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

    logger.error('Create application error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create application',
      code: 500,
    });
  }
}

/**
 * List Applications
 * GET /orders/:orderId/applications
 */
export async function listApplicationsController(req: AuthRequest, res: Response): Promise<void> {
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

    const applications = await listApplications(orderId, partnerId);

    res.status(200).json(applications);
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

    logger.error('List applications error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to list applications',
      code: 500,
    });
  }
}

/**
 * Get Application Detail
 * GET /applications/:applicationId
 */
export async function getApplicationDetailController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const partnerId = req.partnerId;
    const applicationId = req.params.applicationId;

    if (!partnerId) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner ID not found',
        code: 401,
      });
      return;
    }

    if (!applicationId) {
      res.status(400).json({
        error: 'APPLICATION_ID_REQUIRED',
        message: 'Application ID is required',
        code: 400,
      });
      return;
    }

    const application = await getApplicationDetail(applicationId, partnerId);

    res.status(200).json(application);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'APPLICATION_NOT_FOUND') {
        res.status(404).json({
          error: 'APPLICATION_NOT_FOUND',
          message: 'Application not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'APPLICATION_ACCESS_DENIED') {
        res.status(403).json({
          error: 'APPLICATION_ACCESS_DENIED',
          message: 'Access denied to this application',
          code: 403,
        });
        return;
      }
    }

    logger.error('Get application detail error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get application detail',
      code: 500,
    });
  }
}

/**
 * Update Application
 * PUT /applications/:applicationId
 */
export async function updateApplicationController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const partnerId = req.partnerId;
    const applicationId = req.params.applicationId;

    if (!partnerId) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner ID not found',
        code: 401,
      });
      return;
    }

    if (!applicationId) {
      res.status(400).json({
        error: 'APPLICATION_ID_REQUIRED',
        message: 'Application ID is required',
        code: 400,
      });
      return;
    }

    // Validate input (partial updates allowed)
    const validated = applicationSchema.partial().parse(req.body) as Partial<ApplicationInput>;

    const result = await updateApplication(applicationId, partnerId, validated);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'APPLICATION_NOT_FOUND') {
        res.status(404).json({
          error: 'APPLICATION_NOT_FOUND',
          message: 'Application not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'APPLICATION_ACCESS_DENIED') {
        res.status(403).json({
          error: 'APPLICATION_ACCESS_DENIED',
          message: 'Access denied to this application',
          code: 403,
        });
        return;
      }

      if (error.message === 'ORDER_NOT_EDITABLE') {
        res.status(400).json({
          error: 'ORDER_NOT_EDITABLE',
          message: 'Order cannot be edited in current status',
          code: 400,
        });
        return;
      }

      if (error.message === 'APPLICATION_NOT_EDITABLE') {
        res.status(400).json({
          error: 'APPLICATION_NOT_EDITABLE',
          message: 'Application cannot be edited when status is APPROVED or REJECTED',
          code: 400,
        });
        return;
      }

      if (error.message === 'PASSPORT_EXPIRY_INVALID') {
        res.status(400).json({
          error: 'PASSPORT_EXPIRY_INVALID',
          message: 'Passport expiry date must be after travel end date',
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

    logger.error('Update application error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update application',
      code: 500,
    });
  }
}

/**
 * Set Primary Applicant
 * POST /orders/:orderId/applications/:applicationId/set-primary
 */
export async function setPrimaryApplicantController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const partnerId = req.partnerId;
    const orderId = req.params.orderId;
    const applicationId = req.params.applicationId;

    if (!partnerId) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner ID not found',
        code: 401,
      });
      return;
    }

    if (!orderId || !applicationId) {
      res.status(400).json({
        error: 'IDS_REQUIRED',
        message: 'Order ID and Application ID are required',
        code: 400,
      });
      return;
    }

    const result = await setPrimaryApplicant(orderId, applicationId, partnerId);

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

      if (error.message === 'APPLICATION_NOT_FOUND') {
        res.status(404).json({
          error: 'APPLICATION_NOT_FOUND',
          message: 'Application not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'APPLICATION_NOT_IN_ORDER') {
        res.status(400).json({
          error: 'APPLICATION_NOT_IN_ORDER',
          message: 'Application does not belong to this order',
          code: 400,
        });
        return;
      }
    }

    logger.error('Set primary applicant error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to set primary applicant',
      code: 500,
    });
  }
}

/**
 * Delete Application
 * DELETE /applications/:applicationId
 */
export async function deleteApplicationController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const partnerId = req.partnerId;
    const applicationId = req.params.applicationId;

    if (!partnerId) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner ID not found',
        code: 401,
      });
      return;
    }

    if (!applicationId) {
      res.status(400).json({
        error: 'APPLICATION_ID_REQUIRED',
        message: 'Application ID is required',
        code: 400,
      });
      return;
    }

    const result = await deleteApplication(applicationId, partnerId);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'APPLICATION_NOT_FOUND') {
        res.status(404).json({
          error: 'APPLICATION_NOT_FOUND',
          message: 'Application not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'APPLICATION_ACCESS_DENIED') {
        res.status(403).json({
          error: 'APPLICATION_ACCESS_DENIED',
          message: 'Access denied to this application',
          code: 403,
        });
        return;
      }

      if (error.message === 'ORDER_NOT_EDITABLE') {
        res.status(400).json({
          error: 'ORDER_NOT_EDITABLE',
          message: 'Order cannot be edited in current status',
          code: 400,
        });
        return;
      }
    }

    logger.error('Delete application error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to delete application',
      code: 500,
    });
  }
}

/**
 * Get Application Summary
 * GET /orders/:orderId/applications/summary
 */
export async function getApplicationSummaryController(req: AuthRequest, res: Response): Promise<void> {
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

    const summary = await getApplicationSummary(orderId, partnerId);

    res.status(200).json(summary);
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

    logger.error('Get application summary error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get application summary',
      code: 500,
    });
  }
}
