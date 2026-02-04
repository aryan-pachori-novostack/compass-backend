import { type Request, type Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import {
  getPartnerProfile,
  updatePartnerProfile,
  getKycDocuments,
  uploadKycDocument,
  submitKyc,
  verifyKycDocument,
} from './partner.service.js';
import { updateProfileSchema, uploadKycDocumentSchema, verifyKycDocumentSchema } from './partner.validator.js';
import { authGuard, type AuthRequest } from '../../middlewares/auth_guard.js';
import logger from '../../utils/logger.js';
import { KycDocType } from '@prisma/client';

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'temp');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `kyc-${uniqueSuffix}${ext}`);
  },
});

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
 * Get Partner Profile
 * GET /partner/profile
 */
export async function getProfileController(req: AuthRequest, res: Response): Promise<void> {
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

    const result = await getPartnerProfile(partnerId);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'PARTNER_NOT_FOUND') {
        res.status(404).json({
          error: 'PARTNER_NOT_FOUND',
          message: 'Partner account not found',
          code: 404,
        });
        return;
      }
    }

    logger.error('Get profile error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get profile',
      code: 500,
    });
  }
}

/**
 * Update Partner Profile
 * PUT /partner/profile
 */
export async function updateProfileController(req: AuthRequest, res: Response): Promise<void> {
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
    const validated = updateProfileSchema.parse(req.body);

    const result = await updatePartnerProfile(partnerId, validated);

    res.status(200).json({
      success: true,
      profile_pct: result.profile_pct,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'GST_NUMBER_REQUIRED') {
        res.status(400).json({
          error: 'GST_NUMBER_REQUIRED',
          message: 'GST number is required when GST status is REGISTERED',
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

    logger.error('Update profile error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update profile',
      code: 500,
    });
  }
}

/**
 * Get KYC Documents
 * GET /partner/kyc-documents
 */
export async function getKycDocumentsController(req: AuthRequest, res: Response): Promise<void> {
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

    const documents = await getKycDocuments(partnerId);

    res.status(200).json(documents);
  } catch (error) {
    logger.error('Get KYC documents error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get KYC documents',
      code: 500,
    });
  }
}

/**
 * Upload KYC Document
 * POST /partner/kyc-documents/upload
 */
export const uploadKycDocumentController = [
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
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

      if (!req.file) {
        res.status(400).json({
          error: 'FILE_REQUIRED',
          message: 'File is required',
          code: 400,
        });
        return;
      }

      // Validate doc_type
      const validated = uploadKycDocumentSchema.parse({ doc_type: req.body.doc_type });

      await uploadKycDocument(
        partnerId,
        validated.doc_type as KycDocType,
        req.file.path,
        req.file.originalname
      );

      res.status(200).json({
        success: true,
      });
    } catch (error) {
      if (error instanceof Error) {
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
      }

      logger.error('Upload KYC document error:', { error });
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to upload document',
        code: 500,
      });
    }
  },
];

/**
 * Submit KYC for Verification
 * POST /partner/kyc/submit
 */
export async function submitKycController(req: AuthRequest, res: Response): Promise<void> {
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

    const result = await submitKyc(partnerId);

    res.status(200).json({
      success: true,
      kyc_status: result.kyc_status,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'MANDATORY_DOCUMENTS_MISSING') {
        res.status(400).json({
          error: 'MANDATORY_DOCUMENTS_MISSING',
          message: 'All mandatory documents (PAN, Aadhaar Front, Aadhaar Back) must be uploaded',
          code: 400,
        });
        return;
      }

      if (error.message === 'GST_CERTIFICATE_REQUIRED') {
        res.status(400).json({
          error: 'GST_CERTIFICATE_REQUIRED',
          message: 'GST certificate is required when GST status is REGISTERED',
          code: 400,
        });
        return;
      }
    }

    logger.error('Submit KYC error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to submit KYC',
      code: 500,
    });
  }
}

/**
 * Verify/Reject KYC Document (OPS)
 * POST /ops/partner/kyc-documents/:id/verify
 */
export async function verifyKycDocumentController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const documentId = req.params.id;
    if (!documentId) {
      res.status(400).json({
        error: 'DOCUMENT_ID_REQUIRED',
        message: 'Document ID is required',
        code: 400,
      });
      return;
    }

    // TODO: Add OPS role check here
    // For now, we'll assume the auth guard will handle role verification
    const opsUserId = req.partnerId || 'system'; // In production, get from OPS user context

    // Validate input
    const validated = verifyKycDocumentSchema.parse(req.body);

    const result = await verifyKycDocument(documentId, validated, opsUserId);

    res.status(200).json({
      success: true,
      ...result,
    });
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

    logger.error('Verify KYC document error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to verify document',
      code: 500,
    });
  }
}
