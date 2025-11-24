import { Router, type Request, type Response } from 'express';
import prisma from '../../config/prisma.js';
import { auth_guard, type AuthRequest } from '../../middlewares/auth_guard.js';

const ocr_router = Router();

// GET /ocr/status/:order_id - Get OCR status for an order
ocr_router.get('/status/:order_id', auth_guard, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order_id = req.params.order_id as string;

    // Get order with documents
    const order = await prisma.order.findFirst({
      where: { order_id },
      include: {
        travellers: {
          include: {
            documents: {
              include: {
                required_document: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Order not found',
        code: 404,
      });
      return;
    }

    // Check if user has access to this order
    const partner_id = req.partner_account_id;
    if (!partner_id) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner account ID not found',
        code: 401,
      });
      return;
    }

    const partner_account = await prisma.partnerAccount.findFirst({
      where: { partner_account_id: partner_id },
    });

    if (!partner_account || order.partner_id !== partner_account.id) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this order',
        code: 403,
      });
      return;
    }

    // Build OCR status response
    const ocr_status = {
      order_id: order.order_id,
      total_documents: order.travellers.reduce((sum, t) => sum + t.documents.length, 0),
      travellers: order.travellers.map((traveller) => {
        const passport_docs = traveller.documents.filter((doc) => {
          const doc_name = doc.required_document.document_name.toLowerCase();
          const filename = doc.file_url.toLowerCase();
          return doc_name.includes('passport') || filename.includes('passport');
        });

        return {
          traveller_id: traveller.order_traveller_id,
          full_name: traveller.full_name,
          passport_number: traveller.passport_number,
          passport_expiry_date: traveller.passport_expiry_date,
          documents: passport_docs.map((doc) => ({
            document_id: doc.order_traveller_document_id,
            ocr_status: doc.ocr_status,
            ocr_job_id: doc.ocr_job_id,
            extracted_data: doc.ocr_extracted_data
              ? {
                  passport_number: (doc.ocr_extracted_data as any)?.passport_number,
                  full_name: (doc.ocr_extracted_data as any)?.full_name,
                  date_of_expiry: (doc.ocr_extracted_data as any)?.date_of_expiry,
                }
              : null,
          })),
        };
      }),
    };

    res.status(200).json({
      data: ocr_status,
    });
  } catch (error: unknown) {
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      code: 500,
    });
  }
});

// GET /ocr/status/:order_id/:traveller_id - Get OCR status for a specific traveller
ocr_router.get('/status/:order_id/:traveller_id', auth_guard, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order_id = req.params.order_id as string;
    const traveller_id = req.params.traveller_id as string;

    // Get traveller with documents
    const traveller = await prisma.orderTraveller.findFirst({
      where: { order_traveller_id: traveller_id },
      include: {
        order: true,
        documents: {
          include: {
            required_document: true,
          },
        },
      },
    });

    if (!traveller) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Traveller not found',
        code: 404,
      });
      return;
    }

    // Verify order matches
    if (traveller.order.order_id !== order_id) {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Traveller does not belong to this order',
        code: 400,
      });
      return;
    }

    // Check if user has access
    const partner_id = req.partner_account_id;
    if (!partner_id) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner account ID not found',
        code: 401,
      });
      return;
    }

    const partner_account = await prisma.partnerAccount.findFirst({
      where: { partner_account_id: partner_id },
    });

    if (!partner_account || traveller.order.partner_id !== partner_account.id) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied',
        code: 403,
      });
      return;
    }

    // Get passport documents
    const passport_docs = traveller.documents.filter((doc) => {
      const doc_name = doc.required_document.document_name.toLowerCase();
      const filename = doc.file_url.toLowerCase();
      return doc_name.includes('passport') || filename.includes('passport');
    });

    const ocr_status = {
      traveller_id: traveller.order_traveller_id,
      full_name: traveller.full_name,
      passport_number: traveller.passport_number,
      passport_expiry_date: traveller.passport_expiry_date,
      documents: passport_docs.map((doc) => ({
        document_id: doc.order_traveller_document_id,
        ocr_status: doc.ocr_status,
        ocr_job_id: doc.ocr_job_id,
        extracted_data: doc.ocr_extracted_data
          ? {
              passport_number: (doc.ocr_extracted_data as any)?.passport_number,
              full_name: (doc.ocr_extracted_data as any)?.full_name,
              given_names: (doc.ocr_extracted_data as any)?.given_names,
              surname: (doc.ocr_extracted_data as any)?.surname,
              date_of_birth: (doc.ocr_extracted_data as any)?.date_of_birth,
              date_of_expiry: (doc.ocr_extracted_data as any)?.date_of_expiry,
              nationality: (doc.ocr_extracted_data as any)?.nationality,
              is_valid: (doc.ocr_extracted_data as any)?.is_valid,
            }
          : null,
      })),
    };

    res.status(200).json({
      data: ocr_status,
    });
  } catch (error: unknown) {
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      code: 500,
    });
  }
});

export default ocr_router;

