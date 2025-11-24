import { Router, type Request, type Response } from 'express';
import order_service from '../../modules/order/order.service.js';
import { auth_guard, type AuthRequest } from '../../middlewares/auth_guard.js';
import { upload, get_file_path, delete_file } from '../../utils/file_upload.js';
import prisma from '../../config/prisma.js';

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

export default order_router;

