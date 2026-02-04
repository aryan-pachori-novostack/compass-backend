import { type Response } from 'express';
import {
  createSupportTicket,
  listPartnerTickets,
  getTicketDetail,
  listOpsTickets,
  updateTicketStatus,
} from './support.service.js';
import { authGuard, type AuthRequest } from '../../middlewares/auth_guard.js';
import { opsGuard, type OpsRequest } from '../../middlewares/ops_guard.js';
import logger from '../../utils/logger.js';

/**
 * Create Support Ticket
 * POST /support/tickets
 */
export async function createSupportTicketController(req: AuthRequest, res: Response): Promise<void> {
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

    const { order_id, category, sub_category, subject, description, consent_given, attachments } = req.body;

    if (!category || !subject || !description) {
      res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Category, subject, and description are required',
        code: 400,
      });
      return;
    }

    if (consent_given !== true) {
      res.status(400).json({
        error: 'CONSENT_REQUIRED',
        message: 'Consent must be given to create a ticket',
        code: 400,
      });
      return;
    }

    const result = await createSupportTicket(partnerId, {
      order_id,
      category,
      sub_category,
      subject,
      description,
      consent_given,
      attachments,
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'CONSENT_REQUIRED') {
        res.status(400).json({
          error: 'CONSENT_REQUIRED',
          message: 'Consent must be given',
          code: 400,
        });
        return;
      }

      if (error.message === 'ORDER_NOT_FOUND') {
        res.status(404).json({
          error: 'ORDER_NOT_FOUND',
          message: 'Order not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'ORDER_ACCESS_DENIED') {
        res.status(403).json({
          error: 'ORDER_ACCESS_DENIED',
          message: 'Access denied to this order',
          code: 403,
        });
        return;
      }
    }

    logger.error('Create support ticket error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create support ticket',
      code: 500,
    });
  }
}

/**
 * List Partner Tickets
 * GET /support/tickets
 */
export async function listPartnerTicketsController(req: AuthRequest, res: Response): Promise<void> {
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

    const status = req.query.status as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const result = await listPartnerTickets(partnerId, status as any, page, limit);

    res.status(200).json(result);
  } catch (error) {
    logger.error('List partner tickets error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to list tickets',
      code: 500,
    });
  }
}

/**
 * Get Ticket Detail
 * GET /support/tickets/:ticketId
 */
export async function getTicketDetailController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const partnerId = req.partnerId;
    const ticketId = req.params.ticketId;

    if (!partnerId) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Partner ID not found',
        code: 401,
      });
      return;
    }

    if (!ticketId) {
      res.status(400).json({
        error: 'TICKET_ID_REQUIRED',
        message: 'Ticket ID is required',
        code: 400,
      });
      return;
    }

    const ticket = await getTicketDetail(ticketId, partnerId);

    res.status(200).json(ticket);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'TICKET_NOT_FOUND') {
        res.status(404).json({
          error: 'TICKET_NOT_FOUND',
          message: 'Ticket not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'TICKET_ACCESS_DENIED') {
        res.status(403).json({
          error: 'TICKET_ACCESS_DENIED',
          message: 'Access denied to this ticket',
          code: 403,
        });
        return;
      }
    }

    logger.error('Get ticket detail error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get ticket detail',
      code: 500,
    });
  }
}

/**
 * Ops List Tickets
 * GET /ops/support/tickets
 */
export async function listOpsTicketsController(req: OpsRequest, res: Response): Promise<void> {
  try {
    const filters: {
      status?: string;
      category?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    if (req.query.status) {
      filters.status = req.query.status as string;
    }
    if (req.query.category) {
      filters.category = req.query.category as string;
    }
    if (req.query.search) {
      filters.search = req.query.search as string;
    }

    const result = await listOpsTickets(filters as any);

    res.status(200).json(result);
  } catch (error) {
    logger.error('List ops tickets error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to list tickets',
      code: 500,
    });
  }
}

/**
 * Ops Update Ticket Status
 * POST /ops/support/tickets/:ticketId/status
 */
export async function updateTicketStatusController(req: OpsRequest, res: Response): Promise<void> {
  try {
    const ticketId = req.params.ticketId;
    const opsUserId = req.opsUserId;
    const { status, resolution_notes } = req.body;

    if (!ticketId) {
      res.status(400).json({
        error: 'TICKET_ID_REQUIRED',
        message: 'Ticket ID is required',
        code: 400,
      });
      return;
    }

    if (!status) {
      res.status(400).json({
        error: 'STATUS_REQUIRED',
        message: 'Status is required',
        code: 400,
      });
      return;
    }

    const result = await updateTicketStatus(ticketId, status, resolution_notes, opsUserId);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'TICKET_NOT_FOUND') {
        res.status(404).json({
          error: 'TICKET_NOT_FOUND',
          message: 'Ticket not found',
          code: 404,
        });
        return;
      }

      if (error.message === 'TICKET_ALREADY_CLOSED') {
        res.status(400).json({
          error: 'TICKET_ALREADY_CLOSED',
          message: 'Cannot update a closed ticket',
          code: 400,
        });
        return;
      }

      if (error.message === 'INVALID_STATUS_TRANSITION' || error.message.includes('Invalid transition')) {
        res.status(400).json({
          error: 'INVALID_STATUS_TRANSITION',
          message: error.message,
          code: 400,
        });
        return;
      }

      if (error.message === 'RESOLUTION_NOTES_REQUIRED') {
        res.status(400).json({
          error: 'RESOLUTION_NOTES_REQUIRED',
          message: 'Resolution notes are required for RESOLVED or CLOSED status',
          code: 400,
        });
        return;
      }
    }

    logger.error('Update ticket status error:', { error });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update ticket status',
      code: 500,
    });
  }
}
