import {
  PrismaClient,
  ApplicationSoftStatus,
  ApplicationFormalitiesStatus,
  VisaCaseStatus,
  OrderStatus,
  OrderType,
} from '@prisma/client';
import prisma from '../../config/prisma.js';
import { computeOrderReadiness } from '../orders/orders.readiness.js';
import type { ApplicationInput } from './applications.validator.js';
import { normalizeApplicationData, validatePassportExpiry } from './applications.validator.js';
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
 * Ensure exactly one primary applicant in order
 */
async function enforcePrimaryApplicant(
  tx: any,
  orderId: string,
  applicationId: string,
  isPrimary: boolean
): Promise<void> {
  if (isPrimary) {
    // Set all other applications to false
    await tx.visaApplication.updateMany({
      where: {
        order_id: orderId,
        id: { not: applicationId },
      },
      data: {
        is_primary_applicant: false,
      },
    });
  }
}

/**
 * Auto-assign primary if no primary exists
 */
async function autoAssignPrimaryIfNeeded(
  tx: any,
  orderId: string,
  applicationId: string
): Promise<void> {
  const primaryCount = await tx.visaApplication.count({
    where: {
      order_id: orderId,
      is_primary_applicant: true,
    },
  });

  if (primaryCount === 0) {
    await tx.visaApplication.update({
      where: { id: applicationId },
      data: { is_primary_applicant: true },
    });
  }
}

/**
 * Create Application (Add Traveller)
 */
export async function createApplication(
  orderId: string,
  partnerId: string,
  input: ApplicationInput
) {
  return await prisma.$transaction(async (tx) => {
    // Verify order exists and ownership
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        partner_id: true,
        order_type: true,
        status: true,
        travel_end: true,
        applications: {
          select: { id: true },
        },
      },
    });

    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }

    if (order.partner_id !== partnerId) {
      throw new Error('ORDER_ACCESS_DENIED');
    }

    // Check order status
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.COMPLETED) {
      throw new Error('ORDER_NOT_EDITABLE');
    }

    // Check order type constraint
    if (order.order_type === OrderType.INDIVIDUAL && order.applications.length > 0) {
      throw new Error('INDIVIDUAL_ORDER_LIMIT');
    }

    // Validate passport expiry if travel_end exists
    if (input.passport_expiry_date && order.travel_end) {
      const validation = validatePassportExpiry(input.passport_expiry_date, order.travel_end);
      if (!validation.valid) {
        throw new Error('PASSPORT_EXPIRY_INVALID');
      }
    }

    // Normalize data
    const normalized = normalizeApplicationData(input);

    // Determine if primary
    let isPrimary = normalized.is_primary_applicant ?? false;
    if (order.applications.length === 0) {
      // First application is always primary
      isPrimary = true;
    }

    // Create application
    const application = await tx.visaApplication.create({
      data: {
        order_id: orderId,
        is_primary_applicant: isPrimary,
        full_name: normalized.full_name!,
        email: normalized.email || null,
        phone: normalized.phone || null,
        date_of_birth: normalized.date_of_birth ? new Date(normalized.date_of_birth) : null,
        nationality: normalized.nationality || null,
        passport_number: normalized.passport_number || null,
        passport_issue_date: normalized.passport_issue_date ? new Date(normalized.passport_issue_date) : null,
        passport_expiry_date: normalized.passport_expiry_date ? new Date(normalized.passport_expiry_date) : null,
        sex: normalized.sex || null,
        place_of_birth: normalized.place_of_birth || null,
        place_of_issue: normalized.place_of_issue || null,
        marital_status: normalized.marital_status || null,
        mother_name: normalized.mother_name || null,
        father_name: normalized.father_name || null,
        address: normalized.address || null,
        education: normalized.education || null,
        profession: normalized.profession || null,
        soft_status: ApplicationSoftStatus.PENDING,
        formalities_status: ApplicationFormalitiesStatus.INCOMPLETE,
        visa_case_status: VisaCaseStatus.DRAFT,
        additional_docs_needed: false,
      },
    });

    // Enforce primary applicant uniqueness
    if (isPrimary) {
      await enforcePrimaryApplicant(tx, orderId, application.id, true);
    }

    // Recompute order readiness
    const readiness = await computeOrderReadiness(orderId, partnerId);
    await tx.order.update({
      where: { id: orderId },
      data: { status: readiness.suggested_status },
    });

    // Log activity
    await logActivity(partnerId, 'APPLICATION_CREATED', `Application created: ${application.full_name}`, {
      application_id: application.id,
      order_id: orderId,
    });

    return {
      id: application.id,
      order_id: application.order_id,
      is_primary_applicant: application.is_primary_applicant,
    };
  });
}

/**
 * List Applications in Order
 */
export async function listApplications(orderId: string, partnerId: string) {
  // Verify order ownership
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      partner_id: true,
    },
  });

  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  if (order.partner_id !== partnerId) {
    throw new Error('ORDER_ACCESS_DENIED');
  }

  const applications = await prisma.visaApplication.findMany({
    where: { order_id: orderId },
    select: {
      id: true,
      full_name: true,
      passport_number: true,
      is_primary_applicant: true,
      soft_status: true,
      formalities_status: true,
      visa_case_status: true,
      additional_docs_needed: true,
    },
    orderBy: [
      { is_primary_applicant: 'desc' },
      { created_at: 'asc' },
    ],
  });

  return applications;
}

/**
 * Get Application Detail
 */
export async function getApplicationDetail(applicationId: string, partnerId: string) {
  const application = await prisma.visaApplication.findUnique({
    where: { id: applicationId },
    include: {
      order: {
        select: {
          id: true,
          partner_id: true,
        },
      },
    },
  });

  if (!application) {
    throw new Error('APPLICATION_NOT_FOUND');
  }

  if (application.order.partner_id !== partnerId) {
    throw new Error('APPLICATION_ACCESS_DENIED');
  }

  return {
    id: application.id,
    application_code: application.application_code,
    order_id: application.order_id,
    is_primary_applicant: application.is_primary_applicant,
    full_name: application.full_name,
    email: application.email,
    phone: application.phone,
    date_of_birth: application.date_of_birth,
    nationality: application.nationality,
    passport_number: application.passport_number,
    passport_issue_date: application.passport_issue_date,
    passport_expiry_date: application.passport_expiry_date,
    sex: application.sex,
    place_of_birth: application.place_of_birth,
    place_of_issue: application.place_of_issue,
    marital_status: application.marital_status,
    mother_name: application.mother_name,
    father_name: application.father_name,
    address: application.address,
    education: application.education,
    profession: application.profession,
    soft_status: application.soft_status,
    formalities_status: application.formalities_status,
    visa_case_status: application.visa_case_status,
    additional_docs_needed: application.additional_docs_needed,
    additional_docs_note: application.additional_docs_note,
    created_at: application.created_at,
    updated_at: application.updated_at,
  };
}

/**
 * Update Application
 */
export async function updateApplication(
  applicationId: string,
  partnerId: string,
  input: Partial<ApplicationInput>
) {
  return await prisma.$transaction(async (tx) => {
    // Get application with order
    const application = await tx.visaApplication.findUnique({
      where: { id: applicationId },
      include: {
        order: {
          select: {
            id: true,
            partner_id: true,
            status: true,
            travel_end: true,
          },
        },
      },
    });

    if (!application) {
      throw new Error('APPLICATION_NOT_FOUND');
    }

    if (application.order.partner_id !== partnerId) {
      throw new Error('APPLICATION_ACCESS_DENIED');
    }

    // Check order status
    if (application.order.status === OrderStatus.CANCELLED || application.order.status === OrderStatus.COMPLETED) {
      throw new Error('ORDER_NOT_EDITABLE');
    }

    // Check if application can be edited (not APPROVED/REJECTED)
    if (
      application.visa_case_status === VisaCaseStatus.APPROVED ||
      application.visa_case_status === VisaCaseStatus.REJECTED
    ) {
      throw new Error('APPLICATION_NOT_EDITABLE');
    }

    // Validate passport expiry if travel_end exists
    if (input.passport_expiry_date && application.order.travel_end) {
      const validation = validatePassportExpiry(input.passport_expiry_date, application.order.travel_end);
      if (!validation.valid) {
        throw new Error('PASSPORT_EXPIRY_INVALID');
      }
    }

    // Normalize data
    const normalized = normalizeApplicationData(input);

    // Track if critical fields changed
    const criticalFieldsChanged =
      normalized.full_name !== undefined && normalized.full_name !== application.full_name ||
      normalized.passport_number !== undefined && normalized.passport_number !== application.passport_number;

    // Build update data
    const updateData: any = {};
    if (normalized.full_name !== undefined) updateData.full_name = normalized.full_name;
    if (normalized.email !== undefined) updateData.email = normalized.email || null;
    if (normalized.phone !== undefined) updateData.phone = normalized.phone || null;
    if (normalized.date_of_birth !== undefined) updateData.date_of_birth = normalized.date_of_birth ? new Date(normalized.date_of_birth) : null;
    if (normalized.nationality !== undefined) updateData.nationality = normalized.nationality || null;
    if (normalized.passport_number !== undefined) updateData.passport_number = normalized.passport_number || null;
    if (normalized.passport_issue_date !== undefined) updateData.passport_issue_date = normalized.passport_issue_date ? new Date(normalized.passport_issue_date) : null;
    if (normalized.passport_expiry_date !== undefined) updateData.passport_expiry_date = normalized.passport_expiry_date ? new Date(normalized.passport_expiry_date) : null;
    if (normalized.sex !== undefined) updateData.sex = normalized.sex || null;
    if (normalized.place_of_birth !== undefined) updateData.place_of_birth = normalized.place_of_birth || null;
    if (normalized.place_of_issue !== undefined) updateData.place_of_issue = normalized.place_of_issue || null;
    if (normalized.marital_status !== undefined) updateData.marital_status = normalized.marital_status || null;
    if (normalized.mother_name !== undefined) updateData.mother_name = normalized.mother_name || null;
    if (normalized.father_name !== undefined) updateData.father_name = normalized.father_name || null;
    if (normalized.address !== undefined) updateData.address = normalized.address || null;
    if (normalized.education !== undefined) updateData.education = normalized.education || null;
    if (normalized.profession !== undefined) updateData.profession = normalized.profession || null;

    // Handle primary applicant
    if (normalized.is_primary_applicant !== undefined) {
      updateData.is_primary_applicant = normalized.is_primary_applicant;
      if (normalized.is_primary_applicant) {
        await enforcePrimaryApplicant(tx, application.order_id, applicationId, true);
      }
    }

    // Update application
    await tx.visaApplication.update({
      where: { id: applicationId },
      data: updateData,
    });

    // Recompute order readiness
    const readiness = await computeOrderReadiness(application.order_id, partnerId);
    await tx.order.update({
      where: { id: application.order_id },
      data: { status: readiness.suggested_status },
    });

    // Log activity
    const eventType = criticalFieldsChanged ? 'APPLICATION_UPDATED_CRITICAL' : 'APPLICATION_UPDATED';
    await logActivity(partnerId, eventType, `Application updated: ${application.full_name}`, {
      application_id: applicationId,
      order_id: application.order_id,
      critical_fields_changed: criticalFieldsChanged,
    });

    return { success: true };
  });
}

/**
 * Set Primary Applicant
 */
export async function setPrimaryApplicant(
  orderId: string,
  applicationId: string,
  partnerId: string
) {
  return await prisma.$transaction(async (tx) => {
    // Verify order ownership
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        partner_id: true,
      },
    });

    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }

    if (order.partner_id !== partnerId) {
      throw new Error('ORDER_ACCESS_DENIED');
    }

    // Verify application belongs to order
    const application = await tx.visaApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        order_id: true,
        full_name: true,
      },
    });

    if (!application) {
      throw new Error('APPLICATION_NOT_FOUND');
    }

    if (application.order_id !== orderId) {
      throw new Error('APPLICATION_NOT_IN_ORDER');
    }

    // Set this as primary and others as false
    await enforcePrimaryApplicant(tx, orderId, applicationId, true);

    await tx.visaApplication.update({
      where: { id: applicationId },
      data: { is_primary_applicant: true },
    });

    // Log activity
    await logActivity(partnerId, 'PRIMARY_APPLICANT_CHANGED', `Primary applicant changed to: ${application.full_name}`, {
      application_id: applicationId,
      order_id: orderId,
    });

    return { success: true };
  });
}

/**
 * Delete Application
 */
export async function deleteApplication(applicationId: string, partnerId: string) {
  return await prisma.$transaction(async (tx) => {
    // Get application with order
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

    if (application.order.partner_id !== partnerId) {
      throw new Error('APPLICATION_ACCESS_DENIED');
    }

    // Check order status
    const allowedStatuses: OrderStatus[] = [
      OrderStatus.DRAFT,
      OrderStatus.ACTION_REQUIRED,
      OrderStatus.READY_TO_PROCEED,
    ];

    if (!allowedStatuses.includes(application.order.status)) {
      throw new Error('ORDER_NOT_EDITABLE');
    }

    const wasPrimary = application.is_primary_applicant;
    const orderId = application.order_id;

    // Delete application
    await tx.visaApplication.delete({
      where: { id: applicationId },
    });

    // If deleted was primary, assign new primary (oldest remaining)
    if (wasPrimary) {
      const remainingApplications = await tx.visaApplication.findMany({
        where: { order_id: orderId },
        orderBy: { created_at: 'asc' },
        take: 1,
      });

      const firstRemaining = remainingApplications[0];
      if (firstRemaining) {
        await tx.visaApplication.update({
          where: { id: firstRemaining.id },
          data: { is_primary_applicant: true },
        });
      }
    }

    // Recompute order readiness
    const readiness = await computeOrderReadiness(orderId, partnerId);
    await tx.order.update({
      where: { id: orderId },
      data: { status: readiness.suggested_status },
    });

    // Log activity
    await logActivity(partnerId, 'APPLICATION_DELETED', `Application deleted: ${application.full_name}`, {
      application_id: applicationId,
      order_id: orderId,
    });

    return { success: true };
  });
}

/**
 * Get Application Status Summary
 */
export async function getApplicationSummary(orderId: string, partnerId: string) {
  // Verify order ownership
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      partner_id: true,
    },
  });

  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  if (order.partner_id !== partnerId) {
    throw new Error('ORDER_ACCESS_DENIED');
  }

  const applications = await prisma.visaApplication.findMany({
    where: { order_id: orderId },
    select: {
      soft_status: true,
      formalities_status: true,
      visa_case_status: true,
    },
  });

  const total = applications.length;
  const qualified = applications.filter((a) => a.soft_status === ApplicationSoftStatus.QUALIFIED).length;
  const disqualified = applications.filter((a) => a.soft_status === ApplicationSoftStatus.DISQUALIFIED).length;
  const pending = applications.filter((a) => a.soft_status === ApplicationSoftStatus.PENDING || !a.soft_status).length;

  const formalities = {
    incomplete: applications.filter((a) => a.formalities_status === ApplicationFormalitiesStatus.INCOMPLETE).length,
    in_process: applications.filter((a) => a.formalities_status === ApplicationFormalitiesStatus.IN_PROCESS).length,
    successful: applications.filter((a) => a.formalities_status === ApplicationFormalitiesStatus.SUCCESSFUL).length,
    pending: applications.filter((a) => a.formalities_status === ApplicationFormalitiesStatus.PENDING || !a.formalities_status).length,
  };

  const visaCase = {
    draft: applications.filter((a) => a.visa_case_status === VisaCaseStatus.DRAFT).length,
    in_review: applications.filter((a) => a.visa_case_status === VisaCaseStatus.IN_REVIEW).length,
    in_process: applications.filter((a) => a.visa_case_status === VisaCaseStatus.IN_PROCESS).length,
    approved: applications.filter((a) => a.visa_case_status === VisaCaseStatus.APPROVED).length,
    rejected: applications.filter((a) => a.visa_case_status === VisaCaseStatus.REJECTED).length,
    on_hold: applications.filter((a) => a.visa_case_status === VisaCaseStatus.ON_HOLD).length,
  };

  return {
    total,
    qualified,
    disqualified,
    pending,
    formalities,
    visa_case: visaCase,
  };
}
