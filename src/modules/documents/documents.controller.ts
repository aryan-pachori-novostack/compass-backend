import { type Request, type Response } from 'express';
import multer from 'multer';
import {
  listRequiredDocuments,
  uploadDocument,
  listDocuments,
  deleteDocument,
  retryOcr,
  requestAdditionalDocuments,
} from './documents.service.js';
import { uploadDocumentSchema, requestDocumentsSchema } from './documents.validator.js';
import { authGuard, type AuthRequest } from '../../middlewares/auth_guard.js';
import logger from '../../utils/logger.js';

// Configure multer for file uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF, images
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and images are allowed.'));
    }
  },
});

/**
 * List Required Documents
 * GET /applications/:applicationId/documents/required
 */
export async function listRequiredDocumentsController(req: AuthRequest, res: Response): Promise<void> {
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

    const result = await listRequiredDocuments(applicationId, partnerId);

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
    }

    logger.error('List required documents error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to list required documents',
      code: 500,
    });
  }
}

/**
 * Upload Application Document
 * POST /applications/:applicationId/documents/upload
 */
export const uploadDocumentController = [
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
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

      if (!req.file) {
        res.status(400).json({
          error: 'FILE_REQUIRED',
          message: 'File is required',
          code: 400,
        });
        return;
      }

      // Validate input
      const validated = uploadDocumentSchema.parse({
        required_document_id: req.body.required_document_id || null,
        document_name: req.body.document_name || null,
        source: req.body.source || 'TRAVELLER_UPLOAD',
      });

      const result = await uploadDocument(applicationId, partnerId, req.file, validated);

      res.status(201).json(result);
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

        if (error.message === 'DOCUMENT_NAME_REQUIRED') {
          res.status(400).json({
            error: 'DOCUMENT_NAME_REQUIRED',
            message: 'Document name is required when required_document_id is not provided',
            code: 400,
          });
          return;
        }

        if (error.message === 'REQUIRED_DOCUMENT_NOT_FOUND') {
          res.status(404).json({
            error: 'REQUIRED_DOCUMENT_NOT_FOUND',
            message: 'Required document not found',
            code: 404,
          });
          return;
        }

        // Multer errors
        if (error.message.includes('Invalid file type')) {
          res.status(400).json({
            error: 'INVALID_FILE_TYPE',
            message: error.message,
            code: 400,
          });
          return;
        }

        if (error.message.includes('File too large')) {
          res.status(400).json({
            error: 'FILE_TOO_LARGE',
            message: 'File size exceeds 10MB',
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

      logger.error('Upload document error:', { error });
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to upload document',
        code: 500,
      });
    }
  },
];

/**
 * List Uploaded Documents
 * GET /applications/:applicationId/documents
 */
export async function listDocumentsController(req: AuthRequest, res: Response): Promise<void> {
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

    const documents = await listDocuments(applicationId, partnerId);

    res.status(200).json(documents);
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

    logger.error('List documents error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to list documents',
      code: 500,
    });
  }
}

/**
 * Delete Document
 * DELETE /documents/:documentId
 */
export async function deleteDocumentController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const partnerId = req.partnerId;
    const documentId = req.params.documentId;

    if (!partnerId) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner ID not found',
        code: 401,
      });
      return;
    }

    if (!documentId) {
      res.status(400).json({
        error: 'DOCUMENT_ID_REQUIRED',
        message: 'Document ID is required',
        code: 400,
      });
      return;
    }

    const result = await deleteDocument(documentId, partnerId);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'DOCUMENT_NOT_FOUND') {
        res.status(404).json({
          error: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'DOCUMENT_ACCESS_DENIED') {
        res.status(403).json({
          error: 'DOCUMENT_ACCESS_DENIED',
          message: 'Access denied to this document',
          code: 403,
        });
        return;
      }

      if (error.message === 'DOCUMENT_NOT_DELETABLE') {
        res.status(400).json({
          error: 'DOCUMENT_NOT_DELETABLE',
          message: 'Document cannot be deleted in current status',
          code: 400,
        });
        return;
      }
    }

    logger.error('Delete document error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to delete document',
      code: 500,
    });
  }
}

/**
 * Retry OCR
 * POST /documents/:documentId/retry-ocr
 */
export async function retryOcrController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const partnerId = req.partnerId;
    const documentId = req.params.documentId;

    if (!partnerId) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner ID not found',
        code: 401,
      });
      return;
    }

    if (!documentId) {
      res.status(400).json({
        error: 'DOCUMENT_ID_REQUIRED',
        message: 'Document ID is required',
        code: 400,
      });
      return;
    }

    const result = await retryOcr(documentId, partnerId, false);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'DOCUMENT_NOT_FOUND') {
        res.status(404).json({
          error: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'DOCUMENT_ACCESS_DENIED') {
        res.status(403).json({
          error: 'DOCUMENT_ACCESS_DENIED',
          message: 'Access denied to this document',
          code: 403,
        });
        return;
      }

      if (error.message === 'OCR_NOT_RETRYABLE') {
        res.status(400).json({
          error: 'OCR_NOT_RETRYABLE',
          message: 'OCR can only be retried for FAILED or PENDING documents',
          code: 400,
        });
        return;
      }

      if (error.message === 'DOCUMENT_FILE_MISSING') {
        res.status(400).json({
          error: 'DOCUMENT_FILE_MISSING',
          message: 'Document file is missing',
          code: 400,
        });
        return;
      }

      if (error.message === 'OCR_SUBMISSION_FAILED') {
        res.status(500).json({
          error: 'OCR_SUBMISSION_FAILED',
          message: 'Failed to submit OCR job',
          code: 500,
        });
        return;
      }
    }

    logger.error('Retry OCR error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to retry OCR',
      code: 500,
    });
  }
}

/**
 * Ops Request Additional Documents
 * POST /ops/applications/:applicationId/request-docs
 */
export async function requestAdditionalDocumentsController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const opsUserId = req.partnerId || 'system'; // TODO: Get from OPS user context
    const applicationId = req.params.applicationId;

    if (!applicationId) {
      res.status(400).json({
        error: 'APPLICATION_ID_REQUIRED',
        message: 'Application ID is required',
        code: 400,
      });
      return;
    }

    // Validate input
    const validated = requestDocumentsSchema.parse(req.body);

    const result = await requestAdditionalDocuments(applicationId, opsUserId, validated);

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

    logger.error('Request additional documents error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to request additional documents',
      code: 500,
    });
  }
}
