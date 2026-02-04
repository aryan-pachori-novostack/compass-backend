import { Router } from 'express';
import {
  getProfileController,
  updateProfileController,
  getKycDocumentsController,
  uploadKycDocumentController,
  submitKycController,
} from './partner.controller.js';
import { authGuard } from '../../middlewares/auth_guard.js';

const router = Router();

// All routes require authentication
router.use(authGuard);

/**
 * GET /partner/profile
 * Get partner profile
 */
router.get('/profile', getProfileController);

/**
 * PUT /partner/profile
 * Create or update partner profile
 */
router.put('/profile', updateProfileController);

/**
 * GET /partner/kyc-documents
 * Get all KYC documents
 */
router.get('/kyc-documents', getKycDocumentsController);

/**
 * POST /partner/kyc-documents/upload
 * Upload KYC document
 */
router.post('/kyc-documents/upload', uploadKycDocumentController);

/**
 * POST /partner/kyc/submit
 * Submit KYC for verification
 */
router.post('/kyc/submit', submitKycController);

export default router;
