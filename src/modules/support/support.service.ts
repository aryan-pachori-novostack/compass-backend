import {
  PrismaClient,
  TicketStatus,
  OrderStatus,
} from '@prisma/client';
import prisma from '../../config/prisma.js';
import logger from '../../utils/logger.js';

/**
 * Log activity
 */
async function logActivity(
  partnerId: string,
  eventType: string,
  message: string,
  payload?: Record<string, unknown>
): Promise<void> {
  await prisma.partnerActivityLog.create({
    data: {
      partner_id: partnerId,
      event_type: eventType,
      message,
      payload: payload ? (payload as any) : null,
    },
  });
}

/**
 * Generate ticket code
 */
function generateTicketCode(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TCK-${year}${month}${day}-${random}`;
}

/**
 * Create Support Ticket
 */
export async function createSupportTicket(
  partnerId: string,
  data: {
    order_id?: string;
    category: string;
    sub_category?: string;
    subject: string;
    description: string;
    consent_given: boolean;
    attachments?: string[];
  }
) {
  // Validate consent
  if (!data.consent_given) {
    throw new Error('CONSENT_REQUIRED');
  }

  return await prisma.$transaction(async (tx) => {
    // Validate order if provided
    if (data.order_id) {
      const order = await tx.order.findUnique({
        where: { id: data.order_id },
        select: {
          partner_id: true,
          order_code: true,
        },
      });

      if (!order) {
        throw new Error('ORDER_NOT_FOUND');
      }

      if (order.partner_id !== partnerId) {
        throw new Error('ORDER_ACCESS_DENIED');
      }
    }

    // Generate ticket code
    const ticketCode = generateTicketCode();

    // Create ticket
    const ticket = await tx.supportTicket.create({
      data: {
        partner_id: partnerId,
        order_id: data.order_id || null,
        ticket_code: ticketCode,
        category: data.category,
        sub_category: data.sub_category || null,
        subject: data.subject,
        description: data.description,
        consent_given: data.consent_given,
        attachments: data.attachments || [],
        status: TicketStatus.UNRESOLVED,
      },
    });

    // Log activity
    await logActivity(
      partnerId,
      'SUPPORT_TICKET_CREATED',
      `Support ticket created: ${data.subject}`,
      {
        ticket_id: ticket.id,
        ticket_code: ticket.ticket_code,
        order_id: data.order_id,
        category: data.category,
        subject: data.subject,
      }
    );

    return {
      id: ticket.id,
      ticket_code: ticket.ticket_code,
      status: ticket.status,
    };
  });
}

/**
 * List Partner Tickets
 */
export async function listPartnerTickets(
  partnerId: string,
  status?: TicketStatus,
  page: number = 1,
  limit: number = 20
) {
  const where: { partner_id: string; status?: TicketStatus } = {
    partner_id: partnerId,
  };

  if (status) {
    where.status = status;
  }

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: {
        order: {
          select: {
            order_code: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return {
    items: tickets.map((ticket) => ({
      id: ticket.id,
      ticket_code: ticket.ticket_code,
      subject: ticket.subject,
      category: ticket.category,
      status: ticket.status,
      order_code: ticket.order?.order_code || null,
      created_at: ticket.created_at,
    })),
    page,
    limit,
    total,
  };
}

/**
 * Get Ticket Detail
 */
export async function getTicketDetail(ticketId: string, partnerId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      order: {
        select: {
          id: true,
          order_code: true,
          partner_id: true,
        },
      },
    },
  });

  if (!ticket) {
    throw new Error('TICKET_NOT_FOUND');
  }

  // Verify ownership
  if (ticket.partner_id !== partnerId) {
    throw new Error('TICKET_ACCESS_DENIED');
  }

  return {
    id: ticket.id,
    ticket_code: ticket.ticket_code,
    category: ticket.category,
    sub_category: ticket.sub_category,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    resolution_notes: ticket.resolution_notes,
    attachments: ticket.attachments,
    order_id: ticket.order_id,
    order_code: ticket.order?.order_code || null,
    consent_given: ticket.consent_given,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
  };
}

/**
 * Ops List Tickets
 */
export async function listOpsTickets(
  filters: {
    status?: TicketStatus;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }
) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.category) {
    where.category = filters.category;
  }

  if (filters.search) {
    const searchTerm = filters.search.trim();
    where.OR = [
      { ticket_code: { contains: searchTerm.toUpperCase(), mode: 'insensitive' } },
      { subject: { contains: searchTerm, mode: 'insensitive' } },
      { description: { contains: searchTerm, mode: 'insensitive' } },
      { order: { order_code: { contains: searchTerm.toUpperCase(), mode: 'insensitive' } } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: {
        order: {
          select: {
            order_code: true,
          },
        },
        partner: {
          select: {
            id: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return {
    items: tickets.map((ticket) => ({
      id: ticket.id,
      ticket_code: ticket.ticket_code,
      subject: ticket.subject,
      category: ticket.category,
      status: ticket.status,
      order_code: ticket.order?.order_code || null,
      partner: {
        id: ticket.partner.id,
        email: ticket.partner.email,
        phone: ticket.partner.phone,
      },
      created_at: ticket.created_at,
    })),
    page,
    limit,
    total,
  };
}

/**
 * Validate Status Transition
 */
function validateStatusTransition(
  currentStatus: TicketStatus,
  newStatus: TicketStatus
): { valid: boolean; error?: string } {
  const allowedTransitions: Record<TicketStatus, TicketStatus[]> = {
    [TicketStatus.UNRESOLVED]: [TicketStatus.PENDING, TicketStatus.RESOLVED, TicketStatus.CLOSED],
    [TicketStatus.PENDING]: [TicketStatus.RESOLVED, TicketStatus.CLOSED],
    [TicketStatus.RESOLVED]: [TicketStatus.CLOSED],
    [TicketStatus.CLOSED]: [], // Terminal
  };

  const allowed = allowedTransitions[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    return {
      valid: false,
      error: `Invalid transition from ${currentStatus} to ${newStatus}`,
    };
  }

  return { valid: true };
}

/**
 * Ops Update Ticket Status
 */
export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  resolutionNotes: string | undefined,
  opsUserId: string
) {
  return await prisma.$transaction(async (tx) => {
    // Get ticket
    const ticket = await tx.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        order: {
          select: {
            order_code: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new Error('TICKET_NOT_FOUND');
    }

    // Check if already closed
    if (ticket.status === TicketStatus.CLOSED) {
      throw new Error('TICKET_ALREADY_CLOSED');
    }

    // Validate transition
    const validation = validateStatusTransition(ticket.status, status);
    if (!validation.valid) {
      throw new Error(validation.error || 'INVALID_STATUS_TRANSITION');
    }

    // Require resolution notes for RESOLVED or CLOSED
    if ((status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED) && !resolutionNotes) {
      throw new Error('RESOLUTION_NOTES_REQUIRED');
    }

    // Update ticket
    const updated = await tx.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: status,
        resolution_notes: resolutionNotes || null,
      },
    });

    // Log activity
    await logActivity(
      ticket.partner_id,
      'SUPPORT_TICKET_UPDATED',
      `Support ticket ${status.toLowerCase()}: ${ticket.subject}`,
      {
        ticket_id: ticket.id,
        ticket_code: ticket.ticket_code,
        order_id: ticket.order_id,
        order_code: ticket.order?.order_code,
        status: status,
        resolution_notes: resolutionNotes,
        updated_by: opsUserId,
      }
    );

    return { success: true };
  });
}
