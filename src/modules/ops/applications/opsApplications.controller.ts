import { type Response } from 'express';
import {
  getOpsApplicationQueue,
  getOpsApplicationDetail,
  updateApplicationStatus,
  approveApplication,
  rejectApplication,
  putApplicationOnHold,
  requestAdditionalDocuments,
  clearAdditionalDocsFlag,
} from './opsApplications.service.js';
import { opsGuard, type OpsRequest } from '../../../middlewares/ops_guard.js';
import logger from '../../../utils/logger.js';

/**
 * Get Ops Application Queue
 * GET /ops/applications
 */
export async function getOpsApplicationQueueController(req: OpsRequest, res: Response): Promise<void> {
  try {
    const filters: {
      visa_case_status?: string;
      soft_status?: string;
      formalities_status?: string;
      country_id?: string;
      visa_variant_id?: string;
      search?: string;
      from?: string;
      to?: string;
      page: number;
      limit: number;
    } = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    if (req.query.visa_case_status) {
      filters.visa_case_status = req.query.visa_case_status as string;
    }
    if (req.query.soft_status) {
      filters.soft_status = req.query.soft_status as string;
    }
    if (req.query.formalities_status) {
      filters.formalities_status = req.query.formalities_status as string;
    }
    if (req.query.country_id) {
      filters.country_id = req.query.country_id as string;
    }
    if (req.query.visa_variant_id) {
      filters.visa_variant_id = req.query.visa_variant_id as string;
    }
    if (req.query.search) {
      filters.search = req.query.search as string;
    }
    if (req.query.from) {
      filters.from = req.query.from as string;
    }
    if (req.query.to) {
      filters.to = req.query.to as string;
    }

    const result = await getOpsApplicationQueue(filters);

    res.status(200).json(result);
  } catch (error) {
    logger.error('Get ops application queue error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get application queue',
      code: 500,
    });
  }
}

/**
 * Get Ops Application Detail
 * GET /ops/applications/:applicationId
 */
export async function getOpsApplicationDetailController(req: OpsRequest, res: Response): Promise<void> {
  try {
    const applicationId = req.params.applicationId;

    if (!applicationId) {
      res.status(400).json({
        error: 'APPLICATION_ID_REQUIRED',
        message: 'Application ID is required',
        code: 400,
      });
      return;
    }

    const application = await getOpsApplicationDetail(applicationId);

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
    }

    logger.error('Get ops application detail error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get application detail',
      code: 500,
    });
  }
}

/**
 * Update Application Status
 * POST /ops/applications/:applicationId/status
 */
export async function updateApplicationStatusController(req: OpsRequest, res: Response): Promise<void> {
  try {
    const applicationId = req.params.applicationId;
    const opsUserId = req.opsUserId;

    if (!applicationId) {
      res.status(400).json({
        error: 'APPLICATION_ID_REQUIRED',
        message: 'Application ID is required',
        code: 400,
      });
      return;
    }

    const { visa_case_status, soft_status, formalities_status, note } = req.body;

    const updated = await updateApplicationStatus(
      applicationId,
      {
        visa_case_status,
        soft_status,
        formalities_status,
        note,
      },
      opsUserId
    );

    res.status(200).json(updated);
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

      if (error.message === 'ORDER_CANCELLED') {
        res.status(400).json({
          error: 'ORDER_CANCELLED',
          message: 'Cannot update application for cancelled order',
          code: 400,
        });
        return;
      }

      if (error.message === 'INVALID_STATUS_TRANSITION' || error.message.includes('Invalid transition')) {
        res.status(400).json({
          error: 'INVALID_STATUS_TRANSITION',
          message: error.message,
          code: 400,
        });
        return;
      }

      if (error.message === 'ORDER_NOT_PAID') {
        res.status(400).json({
          error: 'ORDER_NOT_PAID',
          message: 'Order must be paid before approving/rejecting',
          code: 400,
        });
        return;
      }
    }

    logger.error('Update application status error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update application status',
      code: 500,
    });
  }
}

/**
 * Approve Application
 * POST /ops/applications/:applicationId/approve
 */
export async function approveApplicationController(req: OpsRequest, res: Response): Promise<void> {
  try {
    const applicationId = req.params.applicationId;
    const opsUserId = req.opsUserId;
    const { note } = req.body;

    if (!applicationId) {
      res.status(400).json({
        error: 'APPLICATION_ID_REQUIRED',
        message: 'Application ID is required',
        code: 400,
      });
      return;
    }

    const updated = await approveApplication(applicationId, note || 'Application approved', opsUserId);

    res.status(200).json(updated);
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

      if (error.message === 'ORDER_CANCELLED') {
        res.status(400).json({
          error: 'ORDER_CANCELLED',
          message: 'Cannot approve application for cancelled order',
          code: 400,
        });
        return;
      }

      if (error.message === 'INVALID_STATUS_FOR_APPROVAL') {
        res.status(400).json({
          error: 'INVALID_STATUS_FOR_APPROVAL',
          message: 'Application must be IN_REVIEW or IN_PROCESS to approve',
          code: 400,
        });
        return;
      }

      if (error.message === 'ORDER_NOT_PAID') {
        res.status(400).json({
          error: 'ORDER_NOT_PAID',
          message: 'Order must be paid before approving',
          code: 400,
        });
        return;
      }
    }

    logger.error('Approve application error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to approve application',
      code: 500,
    });
  }
}

/**
 * Reject Application
 * POST /ops/applications/:applicationId/reject
 */
export async function rejectApplicationController(req: OpsRequest, res: Response): Promise<void> {
  try {
    const applicationId = req.params.applicationId;
    const opsUserId = req.opsUserId;
    const { reason, note } = req.body;

    if (!applicationId) {
      res.status(400).json({
        error: 'APPLICATION_ID_REQUIRED',
        message: 'Application ID is required',
        code: 400,
      });
      return;
    }

    if (!reason) {
      res.status(400).json({
        error: 'REASON_REQUIRED',
        message: 'Rejection reason is required',
        code: 400,
      });
      return;
    }

    const updated = await rejectApplication(applicationId, reason, note || '', opsUserId);

    res.status(200).json(updated);
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

      if (error.message === 'ORDER_CANCELLED') {
        res.status(400).json({
          error: 'ORDER_CANCELLED',
          message: 'Cannot reject application for cancelled order',
          code: 400,
        });
        return;
      }

      if (error.message === 'CANNOT_REJECT_APPROVED') {
        res.status(400).json({
          error: 'CANNOT_REJECT_APPROVED',
          message: 'Cannot reject an already approved application',
          code: 400,
        });
        return;
      }
    }

    logger.error('Reject application error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to reject application',
      code: 500,
    });
  }
}

/**
 * Put Application On Hold
 * POST /ops/applications/:applicationId/on-hold
 */
export async function putApplicationOnHoldController(req: OpsRequest, res: Response): Promise<void> {
  try {
    const applicationId = req.params.applicationId;
    const opsUserId = req.opsUserId;
    const { note } = req.body;

    if (!applicationId) {
      res.status(400).json({
        error: 'APPLICATION_ID_REQUIRED',
        message: 'Application ID is required',
        code: 400,
      });
      return;
    }

    const updated = await putApplicationOnHold(applicationId, note || 'Application put on hold', opsUserId);

    res.status(200).json(updated);
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

      if (error.message === 'ORDER_CANCELLED') {
        res.status(400).json({
          error: 'ORDER_CANCELLED',
          message: 'Cannot put application on hold for cancelled order',
          code: 400,
        });
        return;
      }

      if (error.message === 'INVALID_STATUS_TRANSITION' || error.message.includes('Invalid transition')) {
        res.status(400).json({
          error: 'INVALID_STATUS_TRANSITION',
          message: error.message,
          code: 400,
        });
        return;
      }
    }

    logger.error('Put application on hold error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to put application on hold',
      code: 500,
    });
  }
}

/**
 * Request Additional Documents
 * POST /ops/applications/:applicationId/request-docs
 */
export async function requestAdditionalDocumentsController(req: OpsRequest, res: Response): Promise<void> {
  try {
    const applicationId = req.params.applicationId;
    const opsUserId = req.opsUserId;
    const { note, documents } = req.body;

    if (!applicationId) {
      res.status(400).json({
        error: 'APPLICATION_ID_REQUIRED',
        message: 'Application ID is required',
        code: 400,
      });
      return;
    }

    if (!note) {
      res.status(400).json({
        error: 'NOTE_REQUIRED',
        message: 'Note is required',
        code: 400,
      });
      return;
    }

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      res.status(400).json({
        error: 'DOCUMENTS_REQUIRED',
        message: 'At least one document is required',
        code: 400,
      });
      return;
    }

    const result = await requestAdditionalDocuments(applicationId, note, documents, opsUserId);

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

      if (error.message === 'ORDER_CANCELLED') {
        res.status(400).json({
          error: 'ORDER_CANCELLED',
          message: 'Cannot request documents for cancelled order',
          code: 400,
        });
        return;
      }
    }

    logger.error('Request additional documents error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to request additional documents',
      code: 500,
    });
  }
}

/**
 * Clear Additional Docs Flag
 * POST /ops/applications/:applicationId/clear-additional-docs
 */
export async function clearAdditionalDocsFlagController(req: OpsRequest, res: Response): Promise<void> {
  try {
    const applicationId = req.params.applicationId;
    const opsUserId = req.opsUserId;

    if (!applicationId) {
      res.status(400).json({
        error: 'APPLICATION_ID_REQUIRED',
        message: 'Application ID is required',
        code: 400,
      });
      return;
    }

    const result = await clearAdditionalDocsFlag(applicationId, opsUserId);

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

      if (error.message === 'PENDING_DOCS_EXIST') {
        res.status(400).json({
          error: 'PENDING_DOCS_EXIST',
          message: 'Cannot clear flag while pending documents exist',
          code: 400,
        });
        return;
      }
    }

    logger.error('Clear additional docs flag error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to clear additional docs flag',
      code: 500,
    });
  }
}
