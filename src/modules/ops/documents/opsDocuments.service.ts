import {
  PrismaClient,
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
 * Verify/Reject Application Document
 */
export async function verifyApplicationDocument(
  documentId: string,
  status: 'VERIFIED' | 'REJECTED',
  verificationNotes: string | undefined,
  opsUserId: string
) {
  return await prisma.$transaction(async (tx) => {
    // Get document with application and order
    const document = await tx.applicationDocument.findUnique({
      where: { id: documentId },
      include: {
        application: {
          include: {
            order: {
              select: {
                id: true,
                partner_id: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!document) {
      throw new Error('DOCUMENT_NOT_FOUND');
    }

    // Check if document has file_url (cannot verify pending requests)
    if (!document.file_url && status === 'VERIFIED') {
      throw new Error('DOCUMENT_FILE_MISSING');
    }

    // Check order status
    if (document.application.order.status === OrderStatus.CANCELLED) {
      throw new Error('ORDER_CANCELLED');
    }

    // Update document
    const updateData: any = {
      status: status === 'VERIFIED' ? DocStatus.VERIFIED : DocStatus.REJECTED,
    };

    if (status === 'VERIFIED') {
      updateData.verified_at = new Date();
      updateData.verification_notes = null;
    } else {
      updateData.verification_notes = verificationNotes || null;
    }

    const updated = await tx.applicationDocument.update({
      where: { id: documentId },
      data: updateData,
    });

    // Log activity
    const eventType = status === 'VERIFIED' ? 'OPS_DOC_VERIFIED' : 'OPS_DOC_REJECTED';
    await logActivity(
      document.application.order.partner_id,
      eventType,
      `Document ${status.toLowerCase()}: ${document.document_name_snapshot}`,
      {
        document_id: documentId,
        application_id: document.application_id,
        order_id: document.application.order.id,
        status,
        verification_notes: verificationNotes,
        updated_by: opsUserId,
      }
    );

    // Check if all required docs are verified and no pending requested docs
    // This can trigger auto-clearing of additional_docs_needed flag
    const allDocs = await tx.applicationDocument.findMany({
      where: {
        application_id: document.application_id,
      },
    });

    const requiredDocs = allDocs.filter((d) => d.required_document_id !== null);
    const allRequiredVerified = requiredDocs.every((d) => d.status === DocStatus.VERIFIED);
    const pendingRequestedDocs = allDocs.filter(
      (d) => d.source === DocSource.OPS_REQUEST && d.status === DocStatus.PENDING
    );

    // Auto-clear additional_docs_needed if all required verified and no pending requested
    if (allRequiredVerified && pendingRequestedDocs.length === 0) {
      const application = await tx.visaApplication.findUnique({
        where: { id: document.application_id },
        select: {
          additional_docs_needed: true,
        },
      });

      if (application?.additional_docs_needed) {
        await tx.visaApplication.update({
          where: { id: document.application_id },
          data: {
            additional_docs_needed: false,
            additional_docs_note: null,
          },
        });

        logger.info('Auto-cleared additional_docs_needed flag', {
          applicationId: document.application_id,
        });
      }
    }

    return updated;
  });
}
