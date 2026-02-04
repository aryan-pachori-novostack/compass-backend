import { Router } from 'express';
import { opsGuard } from '../../middlewares/ops_guard.js';

// Import controllers
import {
  getOpsApplicationQueueController,
  getOpsApplicationDetailController,
  updateApplicationStatusController,
  approveApplicationController,
  rejectApplicationController,
  putApplicationOnHoldController,
  requestAdditionalDocumentsController,
  clearAdditionalDocsFlagController,
} from './applications/opsApplications.controller.js';

import { verifyApplicationDocumentController } from './documents/opsDocuments.controller.js';
import {
  listOpsTicketsController,
  updateTicketStatusController,
} from '../support/support.controller.js';

const router = Router();

// All routes require OPS authentication
router.use(opsGuard);

/**
 * GET /ops/applications
 * Get ops application queue with filters
 */
router.get('/applications', getOpsApplicationQueueController as any);

/**
 * GET /ops/applications/:applicationId
 * Get ops application detail
 */
router.get('/applications/:applicationId', getOpsApplicationDetailController as any);

/**
 * POST /ops/applications/:applicationId/status
 * Update application status (unified)
 */
router.post('/applications/:applicationId/status', updateApplicationStatusController as any);

/**
 * POST /ops/applications/:applicationId/approve
 * Approve application
 */
router.post('/applications/:applicationId/approve', approveApplicationController as any);

/**
 * POST /ops/applications/:applicationId/reject
 * Reject application
 */
router.post('/applications/:applicationId/reject', rejectApplicationController as any);

/**
 * POST /ops/applications/:applicationId/on-hold
 * Put application on hold
 */
router.post('/applications/:applicationId/on-hold', putApplicationOnHoldController as any);

/**
 * POST /ops/applications/:applicationId/request-docs
 * Request additional documents
 */
router.post('/applications/:applicationId/request-docs', requestAdditionalDocumentsController as any);

/**
 * POST /ops/applications/:applicationId/clear-additional-docs
 * Clear additional docs flag
 */
router.post('/applications/:applicationId/clear-additional-docs', clearAdditionalDocsFlagController as any);

/**
 * POST /ops/documents/:documentId/verify
 * Verify/reject application document
 */
router.post('/documents/:documentId/verify', verifyApplicationDocumentController as any);

/**
 * GET /ops/support/tickets
 * List ops tickets (queue)
 */
router.get('/support/tickets', listOpsTicketsController as any);

/**
 * POST /ops/support/tickets/:ticketId/status
 * Update ticket status
 */
router.post('/support/tickets/:ticketId/status', updateTicketStatusController as any);

export default router;
