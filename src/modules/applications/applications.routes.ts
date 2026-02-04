import { Router } from 'express';
import {
  createApplicationController,
  listApplicationsController,
  getApplicationDetailController,
  updateApplicationController,
  setPrimaryApplicantController,
  deleteApplicationController,
  getApplicationSummaryController,
} from './applications.controller.js';
import { authGuard } from '../../middlewares/auth_guard.js';

const router = Router();

// All routes require authentication
router.use(authGuard);

/**
 * POST /orders/:orderId/applications
 * Create application (add traveller)
 */
router.post('/orders/:orderId/applications', createApplicationController);

/**
 * GET /orders/:orderId/applications
 * List applications in order
 */
router.get('/orders/:orderId/applications', listApplicationsController);

/**
 * GET /orders/:orderId/applications/summary
 * Get application status summary
 */
router.get('/orders/:orderId/applications/summary', getApplicationSummaryController);

/**
 * GET /applications/:applicationId
 * Get application detail
 */
router.get('/applications/:applicationId', getApplicationDetailController);

/**
 * PUT /applications/:applicationId
 * Update application
 */
router.put('/applications/:applicationId', updateApplicationController);

/**
 * POST /orders/:orderId/applications/:applicationId/set-primary
 * Set primary applicant
 */
router.post('/orders/:orderId/applications/:applicationId/set-primary', setPrimaryApplicantController);

/**
 * DELETE /applications/:applicationId
 * Delete application
 */
router.delete('/applications/:applicationId', deleteApplicationController);

export default router;
