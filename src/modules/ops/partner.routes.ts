import { Router } from 'express';
import { verifyKycDocumentController } from '../partner/partner.controller.js';
import { requestAdditionalDocumentsController } from '../documents/documents.controller.js';
import { authGuard } from '../../middlewares/auth_guard.js';

const router = Router();

// All OPS routes require authentication
// TODO: Add OPS role check middleware
router.use(authGuard);

/**
 * POST /ops/partner/kyc-documents/:id/verify
 * Verify or reject KYC document (OPS only)
 */
router.post('/partner/kyc-documents/:id/verify', verifyKycDocumentController);

/**
 * POST /ops/applications/:applicationId/request-docs
 * Request additional documents (OPS only)
 */
router.post('/applications/:applicationId/request-docs', requestAdditionalDocumentsController);

export default router;
