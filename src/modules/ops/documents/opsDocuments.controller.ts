import { type Response } from 'express';
import { verifyApplicationDocument } from './opsDocuments.service.js';
import { opsGuard, type OpsRequest } from '../../../middlewares/ops_guard.js';
import logger from '../../../utils/logger.js';

/**
 * Verify/Reject Application Document
 * POST /ops/documents/:documentId/verify
 */
export async function verifyApplicationDocumentController(req: OpsRequest, res: Response): Promise<void> {
  try {
    const documentId = req.params.documentId;
    const opsUserId = req.opsUserId;
    const { status, verification_notes } = req.body;

    if (!documentId) {
      res.status(400).json({
        error: 'DOCUMENT_ID_REQUIRED',
        message: 'Document ID is required',
        code: 400,
      });
      return;
    }

    if (!status || (status !== 'VERIFIED' && status !== 'REJECTED')) {
      res.status(400).json({
        error: 'INVALID_STATUS',
        message: 'Status must be VERIFIED or REJECTED',
        code: 400,
      });
      return;
    }

    const updated = await verifyApplicationDocument(documentId, status, verification_notes, opsUserId);

    res.status(200).json(updated);
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

      if (error.message === 'ORDER_CANCELLED') {
        res.status(400).json({
          error: 'ORDER_CANCELLED',
          message: 'Cannot verify document for cancelled order',
          code: 400,
        });
        return;
      }

      if (error.message === 'DOCUMENT_FILE_MISSING') {
        res.status(400).json({
          error: 'DOCUMENT_FILE_MISSING',
          message: 'Cannot verify document without file',
          code: 400,
        });
        return;
      }
    }

    logger.error('Verify application document error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to verify document',
      code: 500,
    });
  }
}
