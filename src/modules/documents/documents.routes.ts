import { Router } from 'express';
import {
  listRequiredDocumentsController,
  uploadDocumentController,
  listDocumentsController,
  deleteDocumentController,
  retryOcrController,
} from './documents.controller.js';
import { authGuard } from '../../middlewares/auth_guard.js';

const router = Router();

// All routes require authentication
router.use(authGuard);

/**
 * GET /applications/:applicationId/documents/required
 * List required documents for application
 */
router.get('/applications/:applicationId/documents/required', listRequiredDocumentsController);

/**
 * POST /applications/:applicationId/documents/upload
 * Upload application document
 */
router.post('/applications/:applicationId/documents/upload', uploadDocumentController);

/**
 * GET /applications/:applicationId/documents
 * List uploaded documents
 */
router.get('/applications/:applicationId/documents', listDocumentsController);

/**
 * DELETE /documents/:documentId
 * Delete document
 */
router.delete('/documents/:documentId', deleteDocumentController);

/**
 * POST /documents/:documentId/retry-ocr
 * Retry OCR processing
 */
router.post('/documents/:documentId/retry-ocr', retryOcrController);

export default router;
