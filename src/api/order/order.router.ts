import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import order_service from '../../modules/order/order.service.js';
import { auth_guard, type AuthRequest } from '../../middlewares/auth_guard.js';
import { upload, get_file_path, delete_file } from '../../utils/file_upload.js';
import { get_redis_subscriber } from '../../config/redis.js';
import { get_signed_url, extract_s3_key_from_url } from '../../utils/s3.js';
import { env } from '../../config/env.js';
import prisma from '../../config/prisma.js';
import logger from '../../utils/logger.js';

const order_router = Router();

// POST /order - Create new order (Protected)
// For GROUP orders: multipart/form-data with zip_file, group_name, travel_dates
// For INDIVIDUAL orders: JSON body with traveller_name and files
order_router.post('/', auth_guard, upload.single('zip_file'), async (req: AuthRequest, res: Response): Promise<void> => {
  let zip_file_path: string | undefined = undefined;

  try {
    // Get partner_account_id from authenticated user
    const partner_account_id = req.partner_account_id;
    if (!partner_account_id) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner account ID not found',
        code: 401,
      });
      return;
    }

    // Get partner account to get the actual id (not partner_account_id)
    const partner_account = await prisma.partnerAccount.findFirst({
      where: { partner_account_id: partner_account_id },
    });

    if (!partner_account) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Partner account not found',
        code: 404,
      });
      return;
    }

    // Parse form data
    const order_type = req.body.order_type as string;
    const visa_type_id = req.body.visa_type_id as string;
    const country_id = req.body.country_id as string;
    const group_name = req.body.group_name as string | undefined;
    const travel_dates = req.body.travel_dates as string | undefined;

    // Validate required fields
    if (!order_type || !['INDIVIDUAL', 'GROUP'].includes(order_type)) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'order_type is required and must be INDIVIDUAL or GROUP',
        code: 400,
      });
      return;
    }

    if (!visa_type_id) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'visa_type_id is required',
        code: 400,
      });
      return;
    }

    if (!country_id) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'country_id is required',
        code: 400,
      });
      return;
    }

    // Handle GROUP order
    if (order_type === 'GROUP') {
      if (!group_name) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'group_name is required for GROUP orders',
          code: 400,
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'zip_file is required for GROUP orders',
          code: 400,
        });
        return;
      }

      zip_file_path = get_file_path(req.file.filename);
    }

    // Handle INDIVIDUAL order
    let traveller_name: string | undefined = undefined;
    let traveller_files: Array<{ filename: string; file_path: string; file_type: string }> | undefined = undefined;

    if (order_type === 'INDIVIDUAL') {
      traveller_name = req.body.traveller_name as string | undefined;
      
      if (!traveller_name) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'traveller_name is required for INDIVIDUAL orders',
          code: 400,
        });
        return;
      }

      // For individual orders, files can be sent as multipart or JSON
      // This is a simplified version - you may need to handle file uploads differently
      // For now, we'll expect files to be uploaded separately or handle via zip for consistency
      if (req.file) {
        // If zip file is provided for individual, treat it as single passenger
        zip_file_path = get_file_path(req.file.filename);
      }
    }

    // Create order
    const order = await order_service.createOrder({
      partner_account_id: partner_account.partner_account_id,
      visa_type_id,
      country_id,
      order_type: order_type as 'INDIVIDUAL' | 'GROUP',
      ...(group_name ? { group_name } : {}),
      ...(travel_dates ? { travel_dates } : {}),
      ...(zip_file_path ? { zip_file_path } : {}),
      ...(traveller_name ? { traveller_name } : {}),
      ...(traveller_files ? { traveller_files } : {}),
    });

    res.status(201).json({
      data: order,
    });
  } catch (error: unknown) {
    // Clean up uploaded file on error
    if (zip_file_path) {
      await delete_file(zip_file_path);
    }

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: error.message,
        code: 404,
      });
      return;
    }

    if (error instanceof Error && (error.message.includes('required') || error.message.includes('must be'))) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message,
        code: 400,
      });
      return;
    }

    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Failed to create order',
      code: 500,
    });
  }
});

// GET /order/:order_id/progress - SSE endpoint for real-time OCR progress updates
order_router.get('/:order_id/progress', auth_guard, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order_id = req.params.order_id as string;

    if (!order_id) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'order_id is required',
        code: 400,
      });
      return;
    }

    // Verify order belongs to authenticated partner
    const partner_account_id = req.partner_account_id;
    if (!partner_account_id) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner account ID not found',
        code: 401,
      });
      return;
    }

    const partner_account = await prisma.partnerAccount.findFirst({
      where: { partner_account_id },
    });

    if (!partner_account) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Partner account not found',
        code: 404,
      });
      return;
    }

    const order = await prisma.order.findFirst({
      where: {
        order_id,
        partner_id: partner_account.id,
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

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', order_id })}\n\n`);

    // Subscribe to Redis channel for this order
    const channel = `${env.redis.ocr_progress_channel}:${order_id}`;
    const subscriber = get_redis_subscriber();

    await subscriber.subscribe(channel);
    logger.info(`Subscribed to OCR progress channel: ${channel}`);

    // Handle messages from Redis
    const message_handler = async (channel_name: string, message: string) => {
      if (channel_name === channel) {
        try {
          const data = JSON.parse(message);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
          logger.error('Error parsing Redis message:', error);
        }
      }
    };

    subscriber.on('message', message_handler);

    // Handle client disconnect
    req.on('close', () => {
      subscriber.removeListener('message', message_handler);
      subscriber.unsubscribe(channel);
      logger.info(`Unsubscribed from OCR progress channel: ${channel}`);
      res.end();
    });

    // Keep connection alive with heartbeat
    const heartbeat_interval = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30000); // Every 30 seconds

    req.on('close', () => {
      clearInterval(heartbeat_interval);
    });
  } catch (error) {
    logger.error('Error in SSE endpoint:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to establish SSE connection',
        code: 500,
      });
    } else {
      res.end();
    }
  }
});

// GET /order/:order_id/document/:document_id/view - Get signed S3 URL for viewing document
order_router.get('/:order_id/document/:document_id/view', auth_guard, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order_id = req.params.order_id as string;
    const document_id = req.params.document_id as string;

    // Verify order belongs to authenticated partner
    const partner_account_id = req.partner_account_id;
    if (!partner_account_id) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner account ID not found',
        code: 401,
      });
      return;
    }

    const partner_account = await prisma.partnerAccount.findFirst({
      where: { partner_account_id },
    });

    if (!partner_account) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Partner account not found',
        code: 404,
      });
      return;
    }

    const order = await prisma.order.findFirst({
      where: {
        order_id,
        partner_id: partner_account.id,
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

    const document = await prisma.orderTravellerDocument.findFirst({
      where: {
        order_traveller_document_id: document_id,
        order_id: order.id,
      },
    });

    if (!document) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Document not found',
        code: 404,
      });
      return;
    }

    // Extract S3 key from file_url
    const s3_key = extract_s3_key_from_url(document.file_url);
    const signed_url = await get_signed_url(s3_key, 3600); // 1 hour expiry

    res.json({
      data: {
        signed_url,
        expires_in: 3600,
      },
    });
  } catch (error) {
    logger.error('Error getting document view URL:', error);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Failed to get document view URL',
      code: 500,
    });
  }
});

// GET /order/:order_id/document/:document_id/download - Get signed S3 URL for downloading document
order_router.get('/:order_id/document/:document_id/download', auth_guard, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order_id = req.params.order_id as string;
    const document_id = req.params.document_id as string;

    // Verify order belongs to authenticated partner (same logic as view endpoint)
    const partner_account_id = req.partner_account_id;
    if (!partner_account_id) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner account ID not found',
        code: 401,
      });
      return;
    }

    const partner_account = await prisma.partnerAccount.findFirst({
      where: { partner_account_id },
    });

    if (!partner_account) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Partner account not found',
        code: 404,
      });
      return;
    }

    const order = await prisma.order.findFirst({
      where: {
        order_id,
        partner_id: partner_account.id,
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

    const document = await prisma.orderTravellerDocument.findFirst({
      where: {
        order_traveller_document_id: document_id,
        order_id: order.id,
      },
    });

    if (!document) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Document not found',
        code: 404,
      });
      return;
    }

    // Extract S3 key from file_url
    const s3_key = extract_s3_key_from_url(document.file_url);
    const signed_url = await get_signed_url(s3_key, 3600); // 1 hour expiry

    res.json({
      data: {
        signed_url,
        expires_in: 3600,
      },
    });
  } catch (error) {
    logger.error('Error getting document download URL:', error);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Failed to get document download URL',
      code: 500,
    });
  }
});

// GET /order/:order_id/travellers - Get all travellers with extracted data
order_router.get('/:order_id/travellers', auth_guard, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order_id = req.params.order_id as string;

    // Verify order belongs to authenticated partner
    const partner_account_id = req.partner_account_id;
    if (!partner_account_id) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner account ID not found',
        code: 401,
      });
      return;
    }

    const partner_account = await prisma.partnerAccount.findFirst({
      where: { partner_account_id },
    });

    if (!partner_account) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Partner account not found',
        code: 404,
      });
      return;
    }

    const order = await prisma.order.findFirst({
      where: {
        order_id,
        partner_id: partner_account.id,
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

    const travellers = await prisma.orderTraveller.findMany({
      where: {
        order_id: order.id,
      },
      include: {
        documents: {
          include: {
            required_document: true,
          },
        },
      },
    });

    const travellers_data = travellers.map((traveller) => {
      // Extract passport, flight, and hotel data from documents
      let passport_number: string | null = null;
      let hotel_name: string | null = null;
      let flight_number: string | null = null;

      const documents = traveller.documents.map((doc) => {
        const extracted_data = doc.ocr_extracted_data as any;
        
        // Extract passport number
        if (extracted_data && typeof extracted_data === 'object') {
          if (extracted_data.passport_number) {
            passport_number = extracted_data.passport_number;
          }
          if (extracted_data.hotel_name) {
            hotel_name = extracted_data.hotel_name;
          }
          if (extracted_data.flight_number) {
            flight_number = extracted_data.flight_number;
          }
        }

        return {
          document_id: doc.order_traveller_document_id,
          document_type: doc.required_document.document_code,
          view_url: `/order/${order_id}/document/${doc.order_traveller_document_id}/view`,
          extracted_data: extracted_data,
        };
      });

      return {
        traveller_id: traveller.order_traveller_id,
        traveller_name: traveller.full_name,
        passport_number,
        hotel_name,
        flight_number,
        documents,
      };
    });

    res.json({
      data: travellers_data,
    });
  } catch (error) {
    logger.error('Error getting travellers:', error);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Failed to get travellers',
      code: 500,
    });
  }
});

// POST /order/:order_id/ocr-results - Update document with OCR results (called by OCR microservice)
order_router.post('/:order_id/ocr-results', async (req: Request, res: Response): Promise<void> => {
  try {
    const order_id = req.params.order_id as string;
    const { 
      traveller_id, 
      ticket_type, // 'passport', 'flight', 'hotel'
      passport_front_doc_id,
      passport_back_doc_id,
      document_id, // For flight/hotel
      ocr_status, 
      ocr_extracted_data, 
      mapped_to_traveller_id 
    } = req.body;

    if (!traveller_id || !ocr_status) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'traveller_id and ocr_status are required',
        code: 400,
      });
      return;
    }

    // Find order
    const order = await prisma.order.findFirst({
      where: { order_id },
    });

    if (!order) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Order not found',
        code: 404,
      });
      return;
    }

    // Find traveller
    const traveller = await prisma.orderTraveller.findFirst({
      where: {
        order_traveller_id: traveller_id,
        order_id: order.id,
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

    // Handle passport (front + back)
    if (ticket_type === 'passport' && passport_front_doc_id && passport_back_doc_id) {
      // Find passport documents
      const passport_front_doc = await prisma.orderTravellerDocument.findFirst({
        where: {
          order_traveller_document_id: passport_front_doc_id,
          order_id: order.id,
        },
      });

      const passport_back_doc = await prisma.orderTravellerDocument.findFirst({
        where: {
          order_traveller_document_id: passport_back_doc_id,
          order_id: order.id,
        },
      });

      // Update passport front document
      if (passport_front_doc) {
        await prisma.orderTravellerDocument.update({
          where: { id: passport_front_doc.id },
          data: {
            ocr_status: ocr_status as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
            ocr_extracted_data: ocr_extracted_data ? ocr_extracted_data : Prisma.JsonNull,
          },
        });
      }

      // Update passport back document
      if (passport_back_doc) {
        await prisma.orderTravellerDocument.update({
          where: { id: passport_back_doc.id },
          data: {
            ocr_status: ocr_status as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
            ocr_extracted_data: ocr_extracted_data ? ocr_extracted_data : Prisma.JsonNull,
          },
        });
      }

      // Update traveller info from passport OCR
      if (ocr_status === 'COMPLETED' && ocr_extracted_data) {
        const extracted_data = ocr_extracted_data as any;
        if (extracted_data.data) {
          const passport_data = extracted_data.data;
          
          await prisma.orderTraveller.update({
            where: { id: traveller.id },
            data: {
              ...(passport_data.full_name ? { full_name: passport_data.full_name } : {}),
              ...(passport_data.passport_number ? { passport_number: passport_data.passport_number } : {}),
              ...(passport_data.date_of_birth ? { date_of_birth: new Date(passport_data.date_of_birth) } : {}),
              ...(passport_data.expiry_date ? { passport_expiry_date: new Date(passport_data.expiry_date) } : {}),
            },
          });
        }
      }
    } 
    // Handle flight/hotel tickets
    else if ((ticket_type === 'flight' || ticket_type === 'hotel') && document_id) {
      // Find ticket document
      const ticket_doc = await prisma.orderTravellerDocument.findFirst({
        where: {
          order_traveller_document_id: document_id,
          order_id: order.id,
        },
      });

      if (ticket_doc) {
        const mapped_traveller = mapped_to_traveller_id ? 
          await prisma.orderTraveller.findFirst({
            where: { order_traveller_id: mapped_to_traveller_id },
            select: { id: true },
          }) : null;

        await prisma.orderTravellerDocument.update({
          where: { id: ticket_doc.id },
          data: {
            ocr_status: ocr_status as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
            ocr_extracted_data: ocr_extracted_data ? ocr_extracted_data : Prisma.JsonNull,
            ...(mapped_traveller ? {
              mapped_to_traveller_id: mapped_traveller.id,
            } : {}),
          },
        });
      }
    }

    res.json({
      data: {
        status: 'updated',
        traveller_id,
        ticket_type,
      },
    });
  } catch (error) {
    logger.error('Error updating OCR results:', error);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Failed to update OCR results',
      code: 500,
    });
  }
});

// POST /order/:order_id/update-travellers - Update travellers with parsed zip data (called by OCR microservice)
order_router.post('/:order_id/update-travellers', async (req: Request, res: Response): Promise<void> => {
  try {
    const order_id = req.params.order_id as string;
    const { passengers } = req.body;

    if (!passengers || !Array.isArray(passengers)) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'passengers array is required',
        code: 400,
      });
      return;
    }

    // Find order
    const order = await prisma.order.findFirst({
      where: { order_id },
      include: {
        travellers: true,
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

    // Update travellers with parsed data (this is informational, actual documents will be created by OCR service)
    logger.info(`Received parsed data for ${passengers.length} passengers for order ${order_id}`);

    res.json({
      data: {
        status: 'received',
        passengers_count: passengers.length,
      },
    });
  } catch (error) {
    logger.error('Error updating travellers:', error);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Failed to update travellers',
      code: 500,
    });
  }
});

export default order_router;

