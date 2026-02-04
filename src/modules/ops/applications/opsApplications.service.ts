import {
  PrismaClient,
  ApplicationSoftStatus,
  ApplicationFormalitiesStatus,
  VisaCaseStatus,
  DocStatus,
  DocSource,
  OrderStatus,
} from '@prisma/client';
import prisma from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';

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
 * Sync Order Status from Applications
 * Called when applications reach terminal states
 */
export async function syncOrderStatusFromApplications(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      applications: {
        select: {
          visa_case_status: true,
        },
      },
    },
  });

  if (!order) {
    return;
  }

  // If order is cancelled, don't sync
  if (order.status === OrderStatus.CANCELLED) {
    return;
  }

  // Check if all applications are terminal
  const allTerminal = order.applications.every(
    (app) => app.visa_case_status === VisaCaseStatus.APPROVED || app.visa_case_status === VisaCaseStatus.REJECTED
  );

  if (allTerminal && order.applications.length > 0) {
    // Check if all approved
    const allApproved = order.applications.every(
      (app) => app.visa_case_status === VisaCaseStatus.APPROVED
    );

    if (allApproved || order.applications.some((app) => app.visa_case_status === VisaCaseStatus.APPROVED)) {
      // At least one approved, mark order as completed
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.COMPLETED,
        },
      });

      logger.info('Order status synced to COMPLETED', { orderId });
    }
  }
}

/**
 * Validate Status Transitions
 */
function validateStatusTransition(
  currentVisaCaseStatus: VisaCaseStatus,
  newVisaCaseStatus?: VisaCaseStatus,
  currentSoftStatus?: ApplicationSoftStatus | null,
  newSoftStatus?: ApplicationSoftStatus,
  currentFormalitiesStatus?: ApplicationFormalitiesStatus | null,
  newFormalitiesStatus?: ApplicationFormalitiesStatus
): { valid: boolean; error?: string } {
  // Validate visa_case_status transitions
  if (newVisaCaseStatus) {
    const allowedTransitions: Record<VisaCaseStatus, VisaCaseStatus[]> = {
      [VisaCaseStatus.DRAFT]: [VisaCaseStatus.IN_REVIEW],
      [VisaCaseStatus.IN_REVIEW]: [VisaCaseStatus.IN_PROCESS, VisaCaseStatus.ON_HOLD, VisaCaseStatus.REJECTED],
      [VisaCaseStatus.IN_PROCESS]: [VisaCaseStatus.APPROVED, VisaCaseStatus.REJECTED, VisaCaseStatus.ON_HOLD],
      [VisaCaseStatus.ON_HOLD]: [VisaCaseStatus.IN_REVIEW, VisaCaseStatus.IN_PROCESS, VisaCaseStatus.REJECTED],
      [VisaCaseStatus.APPROVED]: [], // Terminal
      [VisaCaseStatus.REJECTED]: [], // Terminal
    };

    const allowed = allowedTransitions[currentVisaCaseStatus] || [];
    if (!allowed.includes(newVisaCaseStatus)) {
      return {
        valid: false,
        error: `Invalid transition from ${currentVisaCaseStatus} to ${newVisaCaseStatus}`,
      };
    }
  }

  // Validate soft_status transitions
  if (newSoftStatus && currentVisaCaseStatus === VisaCaseStatus.APPROVED) {
    return {
      valid: false,
      error: 'Cannot change soft_status when visa_case_status is APPROVED',
    };
  }

  // Validate formalities_status transitions (can move backwards to INCOMPLETE)
  // No strict validation needed, ops can move backwards with note

  return { valid: true };
}

/**
 * Get Ops Application Queue
 */
export async function getOpsApplicationQueue(
  filters: {
    visa_case_status?: string;
    soft_status?: string;
    formalities_status?: string;
    country_id?: string;
    visa_variant_id?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }
) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {
    order: {
      status: {
        not: OrderStatus.CANCELLED, // Exclude cancelled orders
      },
    },
  };

  if (filters.visa_case_status) {
    where.visa_case_status = filters.visa_case_status as VisaCaseStatus;
  }

  if (filters.soft_status) {
    where.soft_status = filters.soft_status as ApplicationSoftStatus;
  }

  if (filters.formalities_status) {
    where.formalities_status = filters.formalities_status as ApplicationFormalitiesStatus;
  }

  if (filters.country_id) {
    where.order = {
      ...where.order,
      country_id: filters.country_id,
    };
  }

  if (filters.visa_variant_id) {
    where.order = {
      ...where.order,
      visa_variant_id: filters.visa_variant_id,
    };
  }

  if (filters.search) {
    const searchTerm = filters.search.trim();
    where.OR = [
      { full_name: { contains: searchTerm, mode: 'insensitive' } },
      { passport_number: { contains: searchTerm.toUpperCase(), mode: 'insensitive' } },
      { order: { order_code: { contains: searchTerm.toUpperCase(), mode: 'insensitive' } } },
    ];
  }

  if (filters.from || filters.to) {
    where.updated_at = {};
    if (filters.from) {
      where.updated_at.gte = new Date(filters.from);
    }
    if (filters.to) {
      where.updated_at.lte = new Date(filters.to);
    }
  }

  // Get applications with order and documents
  const [applications, total] = await Promise.all([
    prisma.visaApplication.findMany({
      where,
      include: {
        order: {
          include: {
            country: {
              select: {
                id: true,
                name: true,
              },
            },
            visa_variant: {
              select: {
                id: true,
                variant_name: true,
              },
            },
          },
        },
        documents: {
          select: {
            id: true,
            status: true,
            source: true,
            required_document_id: true,
          },
        },
      },
      orderBy: {
        updated_at: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.visaApplication.count({ where }),
  ]);

  // Build response with document summaries
  const items = applications.map((app) => {
    // Count documents
    const requiredDocs = app.documents.filter((d) => d.required_document_id !== null);
    const uploadedDocs = app.documents.filter((d) => d.status === DocStatus.UPLOADED || d.status === DocStatus.VERIFIED);
    const pendingVerification = app.documents.filter((d) => d.status === DocStatus.UPLOADED);
    const rejectedDocs = app.documents.filter((d) => d.status === DocStatus.REJECTED);
    const opsRequestedDocs = app.documents.filter((d) => d.source === DocSource.OPS_REQUEST && d.status === DocStatus.PENDING);

    // Get required docs count from visa type (simplified - would need join in production)
    const requiredTotal = requiredDocs.length; // This is approximate, should join with VisaRequiredDocument

    return {
      application: {
        id: app.id,
        application_code: app.application_code,
        full_name: app.full_name,
        passport_number: app.passport_number,
        visa_case_status: app.visa_case_status,
        soft_status: app.soft_status,
        formalities_status: app.formalities_status,
        additional_docs_needed: app.additional_docs_needed,
      },
      order: {
        id: app.order.id,
        order_code: app.order.order_code,
        country: app.order.country.name,
        visa_variant: app.order.visa_variant.variant_name,
        service_mode: app.order.service_mode,
        status: app.order.status,
      },
      documents: {
        required_total: requiredTotal,
        uploaded: uploadedDocs.length,
        pending_verification: pendingVerification.length,
        rejected: rejectedDocs.length,
        ops_requested_pending: opsRequestedDocs.length,
      },
      updated_at: app.updated_at,
    };
  });

  return {
    items,
    page,
    limit,
    total,
  };
}

/**
 * Get Ops Application Detail
 */
export async function getOpsApplicationDetail(applicationId: string) {
  const application = await prisma.visaApplication.findUnique({
    where: { id: applicationId },
    include: {
      order: {
        include: {
          country: {
            select: {
              id: true,
              name: true,
              iso_code: true,
            },
          },
          visa_variant: {
            include: {
              visa_type: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      documents: {
        include: {
          required_document: {
            select: {
              id: true,
              document_code: true,
              document_name: true,
            },
          },
        },
        orderBy: {
          uploaded_at: 'desc',
        },
      },
    },
  });

  if (!application) {
    throw new Error('APPLICATION_NOT_FOUND');
  }

  return application;
}

/**
 * Update Application Status (Unified)
 */
export async function updateApplicationStatus(
  applicationId: string,
  updates: {
    visa_case_status?: VisaCaseStatus;
    soft_status?: ApplicationSoftStatus;
    formalities_status?: ApplicationFormalitiesStatus;
    note?: string;
  },
  opsUserId: string
) {
  return await prisma.$transaction(async (tx) => {
    // Get current application
    const application = await tx.visaApplication.findUnique({
      where: { id: applicationId },
      include: {
        order: {
          select: {
            id: true,
            partner_id: true,
            status: true,
          },
        },
      },
    });

    if (!application) {
      throw new Error('APPLICATION_NOT_FOUND');
    }

    // Check order status
    if (application.order.status === OrderStatus.CANCELLED) {
      throw new Error('ORDER_CANCELLED');
    }

    // Validate transitions
    const validation = validateStatusTransition(
      application.visa_case_status,
      updates.visa_case_status,
      application.soft_status,
      updates.soft_status,
      application.formalities_status,
      updates.formalities_status
    );

    if (!validation.valid) {
      throw new Error(validation.error || 'INVALID_STATUS_TRANSITION');
    }

    // Check if trying to approve/reject
    if (updates.visa_case_status === VisaCaseStatus.APPROVED || updates.visa_case_status === VisaCaseStatus.REJECTED) {
      // Ensure order is paid (IN_PROCESS status indicates payment completed)
      if (application.order.status !== OrderStatus.IN_PROCESS) {
        throw new Error('ORDER_NOT_PAID');
      }
    }

    // Store before state
    const beforeState = {
      visa_case_status: application.visa_case_status,
      soft_status: application.soft_status,
      formalities_status: application.formalities_status,
    };

    // Build update data
    const updateData: any = {};
    if (updates.visa_case_status !== undefined) {
      updateData.visa_case_status = updates.visa_case_status;
    }
    if (updates.soft_status !== undefined) {
      updateData.soft_status = updates.soft_status;
    }
    if (updates.formalities_status !== undefined) {
      updateData.formalities_status = updates.formalities_status;
    }

    // Update application
    const updated = await tx.visaApplication.update({
      where: { id: applicationId },
      data: updateData,
    });

    // Log activity
    await logActivity(
      application.order.partner_id,
      'OPS_STATUS_UPDATE',
      `Application status updated: ${updates.note || 'Status changed'}`,
      {
        application_id: applicationId,
        order_id: application.order.id,
        before: beforeState,
        after: {
          visa_case_status: updated.visa_case_status,
          soft_status: updated.soft_status,
          formalities_status: updated.formalities_status,
        },
        note: updates.note,
        updated_by: opsUserId,
      }
    );

    // Sync order status if terminal
    if (updated.visa_case_status === VisaCaseStatus.APPROVED || updated.visa_case_status === VisaCaseStatus.REJECTED) {
      await syncOrderStatusFromApplications(application.order.id);
    }

    return updated;
  });
}

/**
 * Approve Application
 */
export async function approveApplication(applicationId: string, note: string, opsUserId: string) {
  return await prisma.$transaction(async (tx) => {
    const application = await tx.visaApplication.findUnique({
      where: { id: applicationId },
      include: {
        order: {
          select: {
            id: true,
            partner_id: true,
            status: true,
          },
        },
      },
    });

    if (!application) {
      throw new Error('APPLICATION_NOT_FOUND');
    }

    // Check current status
    if (application.visa_case_status === VisaCaseStatus.APPROVED) {
      // Idempotent - already approved
      return application;
    }

    if (
      application.visa_case_status !== VisaCaseStatus.IN_PROCESS &&
      application.visa_case_status !== VisaCaseStatus.IN_REVIEW
    ) {
      throw new Error('INVALID_STATUS_FOR_APPROVAL');
    }

    // Check order status
    if (application.order.status === OrderStatus.CANCELLED) {
      throw new Error('ORDER_CANCELLED');
    }

    if (application.order.status !== OrderStatus.IN_PROCESS) {
      throw new Error('ORDER_NOT_PAID');
    }

    // Update application
    const updated = await tx.visaApplication.update({
      where: { id: applicationId },
      data: {
        visa_case_status: VisaCaseStatus.APPROVED,
        formalities_status: application.formalities_status === ApplicationFormalitiesStatus.SUCCESSFUL
          ? application.formalities_status
          : ApplicationFormalitiesStatus.SUCCESSFUL,
        soft_status: ApplicationSoftStatus.QUALIFIED,
      },
    });

    // Log activity
    await logActivity(
      application.order.partner_id,
      'OPS_APPLICATION_APPROVED',
      `Application approved: ${note}`,
      {
        application_id: applicationId,
        order_id: application.order.id,
        note,
        updated_by: opsUserId,
      }
    );

    // Sync order status
    await syncOrderStatusFromApplications(application.order.id);

    return updated;
  });
}

/**
 * Reject Application
 */
export async function rejectApplication(
  applicationId: string,
  reason: string,
  note: string,
  opsUserId: string
) {
  return await prisma.$transaction(async (tx) => {
    const application = await tx.visaApplication.findUnique({
      where: { id: applicationId },
      include: {
        order: {
          select: {
            id: true,
            partner_id: true,
            status: true,
          },
        },
      },
    });

    if (!application) {
      throw new Error('APPLICATION_NOT_FOUND');
    }

    // Check if already rejected
    if (application.visa_case_status === VisaCaseStatus.REJECTED) {
      // Idempotent - already rejected
      return application;
    }

    // Check if already approved (cannot reject after approval)
    if (application.visa_case_status === VisaCaseStatus.APPROVED) {
      throw new Error('CANNOT_REJECT_APPROVED');
    }

    // Check order status
    if (application.order.status === OrderStatus.CANCELLED) {
      throw new Error('ORDER_CANCELLED');
    }

    // Update application
    const updated = await tx.visaApplication.update({
      where: { id: applicationId },
      data: {
        visa_case_status: VisaCaseStatus.REJECTED,
        // Don't set additional_docs_needed automatically - ops decides
      },
    });

    // Log activity
    await logActivity(
      application.order.partner_id,
      'OPS_APPLICATION_REJECTED',
      `Application rejected: ${reason}`,
      {
        application_id: applicationId,
        order_id: application.order.id,
        reason,
        note,
        updated_by: opsUserId,
      }
    );

    // Sync order status
    await syncOrderStatusFromApplications(application.order.id);

    return updated;
  });
}

/**
 * Put Application On Hold
 */
export async function putApplicationOnHold(applicationId: string, note: string, opsUserId: string) {
  return await prisma.$transaction(async (tx) => {
    const application = await tx.visaApplication.findUnique({
      where: { id: applicationId },
      include: {
        order: {
          select: {
            id: true,
            partner_id: true,
            status: true,
          },
        },
      },
    });

    if (!application) {
      throw new Error('APPLICATION_NOT_FOUND');
    }

    // Check if already on hold
    if (application.visa_case_status === VisaCaseStatus.ON_HOLD) {
      return application;
    }

    // Validate transition
    const validation = validateStatusTransition(
      application.visa_case_status,
      VisaCaseStatus.ON_HOLD
    );

    if (!validation.valid) {
      throw new Error(validation.error || 'INVALID_STATUS_TRANSITION');
    }

    // Check order status
    if (application.order.status === OrderStatus.CANCELLED) {
      throw new Error('ORDER_CANCELLED');
    }

    // Update application
    const updated = await tx.visaApplication.update({
      where: { id: applicationId },
      data: {
        visa_case_status: VisaCaseStatus.ON_HOLD,
      },
    });

    // Log activity
    await logActivity(
      application.order.partner_id,
      'OPS_APPLICATION_ON_HOLD',
      `Application put on hold: ${note}`,
      {
        application_id: applicationId,
        order_id: application.order.id,
        note,
        updated_by: opsUserId,
      }
    );

    return updated;
  });
}

/**
 * Request Additional Documents
 */
export async function requestAdditionalDocuments(
  applicationId: string,
  note: string,
  documents: Array<{ name: string }>,
  opsUserId: string
) {
  return await prisma.$transaction(async (tx) => {
    const application = await tx.visaApplication.findUnique({
      where: { id: applicationId },
      include: {
        order: {
          select: {
            id: true,
            partner_id: true,
            status: true,
          },
        },
        documents: {
          where: {
            source: DocSource.OPS_REQUEST,
            status: DocStatus.PENDING,
          },
          select: {
            document_name_snapshot: true,
          },
        },
      },
    });

    if (!application) {
      throw new Error('APPLICATION_NOT_FOUND');
    }

    // Check order status
    if (application.order.status === OrderStatus.CANCELLED) {
      throw new Error('ORDER_CANCELLED');
    }

    // Avoid duplicates - check existing requested docs
    const existingDocNames = new Set(application.documents.map((d) => d.document_name_snapshot.toLowerCase()));

    // Create documents for each requested (avoid duplicates)
    for (const doc of documents) {
      const docNameLower = doc.name.toLowerCase();
      if (!existingDocNames.has(docNameLower)) {
        await tx.applicationDocument.create({
          data: {
            application_id: applicationId,
            required_document_id: null,
            document_name_snapshot: doc.name,
            source: DocSource.OPS_REQUEST,
            file_url: null,
            status: DocStatus.PENDING,
            ocr_status: 'PENDING',
          },
        });
        existingDocNames.add(docNameLower);
      }
    }

    // Update application flags
    await tx.visaApplication.update({
      where: { id: applicationId },
      data: {
        additional_docs_needed: true,
        additional_docs_note: note,
      },
    });

    // Log activity
    await logActivity(
      application.order.partner_id,
      'OPS_REQUESTED_DOCS',
      `Additional documents requested: ${documents.map((d) => d.name).join(', ')}`,
      {
        application_id: applicationId,
        order_id: application.order.id,
        note,
        documents: documents.map((d) => d.name),
        updated_by: opsUserId,
      }
    );

    return { success: true };
  });
}

/**
 * Clear Additional Docs Flag
 */
export async function clearAdditionalDocsFlag(applicationId: string, opsUserId: string) {
  return await prisma.$transaction(async (tx) => {
    const application = await tx.visaApplication.findUnique({
      where: { id: applicationId },
      include: {
        order: {
          select: {
            id: true,
            partner_id: true,
          },
        },
        documents: {
          where: {
            source: DocSource.OPS_REQUEST,
            status: {
              not: DocStatus.VERIFIED,
            },
          },
        },
      },
    });

    if (!application) {
      throw new Error('APPLICATION_NOT_FOUND');
    }

    // Check if there are pending requested docs
    if (application.documents.length > 0) {
      throw new Error('PENDING_DOCS_EXIST');
    }

    // Clear flags
    await tx.visaApplication.update({
      where: { id: applicationId },
      data: {
        additional_docs_needed: false,
        additional_docs_note: null,
      },
    });

    // Log activity
    await logActivity(
      application.order.partner_id,
      'OPS_CLEARED_ADDITIONAL_DOCS',
      'Additional documents flag cleared',
      {
        application_id: applicationId,
        order_id: application.order.id,
        updated_by: opsUserId,
      }
    );

    return { success: true };
  });
}
