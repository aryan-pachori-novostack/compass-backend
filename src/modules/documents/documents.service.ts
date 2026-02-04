import {
  PrismaClient,
  DocSource,
  DocStatus,
  OcrStatus,
  VisaCaseStatus,
  OrderStatus,
} from '@prisma/client';
import prisma from '../../config/prisma.js';
import { ocrProvider, uploadFileToStorage } from './ocr.provider.js';
import type { UploadDocumentInput, RequestDocumentsInput } from './documents.validator.js';
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
 * Compute application document completeness
 */
export async function computeApplicationDocCompleteness(applicationId: string) {
  // Get application with order and visa type
  const application = await prisma.visaApplication.findUnique({
    where: { id: applicationId },
    include: {
      order: {
        include: {
          visa_variant: {
            include: {
              visa_type: {
                include: {
                  required_docs: {
                    where: {
                      is_mandatory: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      documents: {
        where: {
          required_document_id: { not: null },
        },
      },
    },
  });

  if (!application) {
    throw new Error('APPLICATION_NOT_FOUND');
  }

  const requiredDocs = application.order.visa_variant.visa_type.required_docs;
  const uploadedDocs = application.documents;

  // Get latest document per required_document_id
  const latestUploaded = new Map<string, typeof uploadedDocs[0]>();
  for (const doc of uploadedDocs) {
    if (doc.required_document_id) {
      const existing = latestUploaded.get(doc.required_document_id);
      if (!existing || doc.uploaded_at > existing.uploaded_at) {
        latestUploaded.set(doc.required_document_id, doc);
      }
    }
  }

  const requiredTotal = requiredDocs.length;
  const requiredUploaded = latestUploaded.size;
  const missingRequiredDocs = requiredDocs
    .filter((req) => !latestUploaded.has(req.id))
    .map((req) => ({
      id: req.id,
      document_code: req.document_code,
      document_name: req.document_name,
    }));

  // Get additional pending documents (OPS_REQUEST with no file_url)
  const additionalPending = await prisma.applicationDocument.findMany({
    where: {
      application_id: applicationId,
      source: DocSource.OPS_REQUEST,
      file_url: null,
      status: DocStatus.PENDING,
    },
    select: {
      id: true,
      document_name_snapshot: true,
    },
  });

  return {
    required_total: requiredTotal,
    required_uploaded: requiredUploaded,
    missing_required_docs: missingRequiredDocs,
    additional_pending: additionalPending,
  };
}

/**
 * List Required Documents for Application
 */
export async function listRequiredDocuments(applicationId: string, partnerId: string) {
  // Verify application ownership
  const application = await prisma.visaApplication.findUnique({
    where: { id: applicationId },
    include: {
      order: {
        select: {
          partner_id: true,
          visa_variant: {
            include: {
              visa_type: {
                include: {
                  required_docs: true,
                },
              },
            },
          },
        },
      },
      documents: {
        where: {
          required_document_id: { not: null },
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

  if (application.order.partner_id !== partnerId) {
    throw new Error('APPLICATION_ACCESS_DENIED');
  }

  const requiredDocs = application.order.visa_variant.visa_type.required_docs;
  
  // Get latest uploaded document per required_document_id
  const latestUploaded = new Map<string, typeof application.documents[0]>();
  for (const doc of application.documents) {
    if (doc.required_document_id) {
      const existing = latestUploaded.get(doc.required_document_id);
      if (!existing || doc.uploaded_at > existing.uploaded_at) {
        latestUploaded.set(doc.required_document_id, doc);
      }
    }
  }

  // Build required documents list
  const required = requiredDocs.map((req) => {
    const uploaded = latestUploaded.get(req.id);
    return {
      id: req.id,
      document_code: req.document_code,
      document_name: req.document_name,
      is_mandatory: req.is_mandatory,
      uploaded: !!uploaded,
      document_id: uploaded?.id || null,
      status: uploaded?.status || null,
      ocr_status: uploaded?.ocr_status || null,
    };
  });

  // Get additional requested documents
  const additionalRequested = await prisma.applicationDocument.findMany({
    where: {
      application_id: applicationId,
      source: DocSource.OPS_REQUEST,
      file_url: null,
    },
    select: {
      id: true,
      document_name_snapshot: true,
      status: true,
    },
  });

  return {
    required,
    additional_requested: additionalRequested,
  };
}

/**
 * Upload Application Document
 */
export async function uploadDocument(
  applicationId: string,
  partnerId: string,
  file: Express.Multer.File,
  input: UploadDocumentInput
) {
  return await prisma.$transaction(async (tx) => {
    // Verify application ownership
    const application = await tx.visaApplication.findUnique({
      where: { id: applicationId },
      include: {
        order: {
          select: {
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

    // Validate input
    if (!input.required_document_id && !input.document_name) {
      throw new Error('DOCUMENT_NAME_REQUIRED');
    }

    // Determine document_name_snapshot
    let documentNameSnapshot: string;
    if (input.required_document_id) {
      const requiredDoc = await tx.visaRequiredDocument.findUnique({
        where: { id: input.required_document_id },
        select: { document_name: true },
      });

      if (!requiredDoc) {
        throw new Error('REQUIRED_DOCUMENT_NOT_FOUND');
      }

      documentNameSnapshot = requiredDoc.document_name;

      // Replace strategy: Delete previous document with same required_document_id
      const previousDocs = await tx.applicationDocument.findMany({
        where: {
          application_id: applicationId,
          required_document_id: input.required_document_id,
        },
      });

      // Delete old documents (replace strategy)
      if (previousDocs.length > 0) {
        await tx.applicationDocument.deleteMany({
          where: {
            application_id: applicationId,
            required_document_id: input.required_document_id,
          },
        });
      }
    } else {
      documentNameSnapshot = input.document_name!;
    }

    // Upload file to storage
    const storagePath = `applications/${applicationId}`;
    const fileUrl = await uploadFileToStorage(file, storagePath);

    // Create ApplicationDocument
    const document = await tx.applicationDocument.create({
      data: {
        application_id: applicationId,
        required_document_id: input.required_document_id || null,
        document_name_snapshot: documentNameSnapshot,
        source: input.source || DocSource.TRAVELLER_UPLOAD,
        file_url: fileUrl,
        status: DocStatus.UPLOADED,
        ocr_status: OcrStatus.PENDING,
      },
    });

    // Submit OCR job (async, non-blocking)
    try {
      const ocrResult = await ocrProvider.submit({
        documentId: document.id,
        fileUrl: fileUrl,
        docName: documentNameSnapshot,
      });

      // Update with OCR job ID
      await tx.applicationDocument.update({
        where: { id: document.id },
        data: {
          ocr_status: OcrStatus.PROCESSING,
          ocr_job_id: ocrResult.jobId,
        },
      });
    } catch (ocrError) {
      // OCR submission failed - keep status as PENDING
      logger.error('OCR submission failed', {
        documentId: document.id,
        error: ocrError,
      });
      // Document is still created, OCR can be retried later
    }

    // Log activity
    await logActivity(partnerId, 'DOCUMENT_UPLOADED', `Document uploaded: ${documentNameSnapshot}`, {
      document_id: document.id,
      application_id: applicationId,
      required_document_id: input.required_document_id,
    });

    return {
      id: document.id,
      file_url: fileUrl,
      status: document.status,
      ocr_status: document.ocr_status,
    };
  });
}

/**
 * List Uploaded Documents
 */
export async function listDocuments(applicationId: string, partnerId: string) {
  // Verify application ownership
  const application = await prisma.visaApplication.findUnique({
    where: { id: applicationId },
    include: {
      order: {
        select: {
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

  const documents = await prisma.applicationDocument.findMany({
    where: {
      application_id: applicationId,
    },
    select: {
      id: true,
      document_name_snapshot: true,
      required_document_id: true,
      file_url: true,
      status: true,
      ocr_status: true,
      ocr_job_id: true,
      verification_notes: true,
      verified_at: true,
      uploaded_at: true,
    },
    orderBy: {
      uploaded_at: 'desc',
    },
  });

  return documents;
}

/**
 * Delete Document
 */
export async function deleteDocument(documentId: string, partnerId: string) {
  return await prisma.$transaction(async (tx) => {
    // Get document with application and order
    const document = await tx.applicationDocument.findUnique({
      where: { id: documentId },
      include: {
        application: {
          include: {
            order: {
              select: {
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

    if (document.application.order.partner_id !== partnerId) {
      throw new Error('DOCUMENT_ACCESS_DENIED');
    }

    // Check if deletion is allowed
    const allowedStatuses: VisaCaseStatus[] = [
      VisaCaseStatus.DRAFT,
      VisaCaseStatus.IN_REVIEW,
    ];

    const orderNotInProcess = document.application.order.status !== OrderStatus.IN_PROCESS;
    const visaCaseStatus = document.application.visa_case_status;

    if (
      !allowedStatuses.includes(visaCaseStatus) &&
      !orderNotInProcess
    ) {
      throw new Error('DOCUMENT_NOT_DELETABLE');
    }

    // Delete document (hard delete)
    await tx.applicationDocument.delete({
      where: { id: documentId },
    });

    // Log activity
    await logActivity(partnerId, 'DOCUMENT_DELETED', `Document deleted: ${document.document_name_snapshot}`, {
      document_id: documentId,
      application_id: document.application_id,
    });

    return { success: true };
  });
}

/**
 * Retry OCR
 */
export async function retryOcr(documentId: string, partnerId: string, isOps: boolean = false) {
  return await prisma.$transaction(async (tx) => {
    // Get document with application
    const document = await tx.applicationDocument.findUnique({
      where: { id: documentId },
      include: {
        application: {
          include: {
            order: {
              select: {
                partner_id: true,
              },
            },
          },
        },
      },
    });

    if (!document) {
      throw new Error('DOCUMENT_NOT_FOUND');
    }

    // Check ownership (unless OPS)
    if (!isOps && document.application.order.partner_id !== partnerId) {
      throw new Error('DOCUMENT_ACCESS_DENIED');
    }

    // Check OCR status
    if (document.ocr_status !== OcrStatus.FAILED && document.ocr_status !== OcrStatus.PENDING) {
      throw new Error('OCR_NOT_RETRYABLE');
    }

    if (!document.file_url) {
      throw new Error('DOCUMENT_FILE_MISSING');
    }

    // Submit OCR job
    try {
      const ocrResult = await ocrProvider.submit({
        documentId: document.id,
        fileUrl: document.file_url,
        docName: document.document_name_snapshot,
      });

      // Update document
      const updated = await tx.applicationDocument.update({
        where: { id: documentId },
        data: {
          ocr_status: OcrStatus.PROCESSING,
          ocr_job_id: ocrResult.jobId,
        },
      });

      // Log activity
      await logActivity(
        isOps ? 'system' : partnerId,
        'OCR_RETRYED',
        'OCR retry submitted',
        {
          document_id: documentId,
          job_id: ocrResult.jobId,
        }
      );

      return {
        id: updated.id,
        ocr_status: updated.ocr_status,
        ocr_job_id: updated.ocr_job_id,
      };
    } catch (ocrError) {
      logger.error('OCR retry failed', {
        documentId,
        error: ocrError,
      });
      throw new Error('OCR_SUBMISSION_FAILED');
    }
  });
}

/**
 * Handle OCR Webhook
 */
export async function handleOcrWebhook(
  jobId: string,
  status: 'COMPLETED' | 'FAILED',
  extractedData?: any,
  documentId?: string
) {
  return await prisma.$transaction(async (tx) => {
    // Find document by job_id or document_id
    let document;
    if (documentId) {
      document = await tx.applicationDocument.findUnique({
        where: { id: documentId },
        include: {
          application: {
            include: {
              order: {
                select: {
                  partner_id: true,
                },
              },
            },
          },
        },
      });
    } else {
      document = await tx.applicationDocument.findFirst({
        where: { ocr_job_id: jobId },
        include: {
          application: {
            include: {
              order: {
                select: {
                  partner_id: true,
                },
              },
            },
          },
        },
      });
    }

    if (!document) {
      logger.warn('OCR webhook received for unknown document', { jobId, documentId });
      return { processed: false, reason: 'DOCUMENT_NOT_FOUND' };
    }

    // Idempotency check: If already COMPLETED, ignore duplicates
    if (document.ocr_status === OcrStatus.COMPLETED && status === 'COMPLETED') {
      logger.info('OCR webhook duplicate ignored (already completed)', { documentId: document.id, jobId });
      return { processed: false, reason: 'ALREADY_COMPLETED' };
    }

    // Update document
    const updateData: any = {
      ocr_status: status === 'COMPLETED' ? OcrStatus.COMPLETED : OcrStatus.FAILED,
    };

    if (extractedData) {
      updateData.ocr_extracted_data = extractedData;
    }

    await tx.applicationDocument.update({
      where: { id: document.id },
      data: updateData,
    });

    // Log activity
    const eventType = status === 'COMPLETED' ? 'OCR_COMPLETED' : 'OCR_FAILED';
    await logActivity(
      document.application.order.partner_id,
      eventType,
      `OCR ${status.toLowerCase()}: ${document.document_name_snapshot}`,
      {
        document_id: document.id,
        job_id: jobId,
        status,
      }
    );

    return { processed: true };
  });
}

/**
 * Ops Request Additional Documents
 */
export async function requestAdditionalDocuments(
  applicationId: string,
  opsUserId: string,
  input: RequestDocumentsInput
) {
  return await prisma.$transaction(async (tx) => {
    // Get application
    const application = await tx.visaApplication.findUnique({
      where: { id: applicationId },
      include: {
        order: {
          select: {
            partner_id: true,
          },
        },
      },
    });

    if (!application) {
      throw new Error('APPLICATION_NOT_FOUND');
    }

    // Create documents for each requested
    for (const docName of input.documents) {
      await tx.applicationDocument.create({
        data: {
          application_id: applicationId,
          required_document_id: null,
          document_name_snapshot: docName,
          source: DocSource.OPS_REQUEST,
          file_url: null,
          status: DocStatus.PENDING,
          ocr_status: OcrStatus.PENDING,
        },
      });
    }

    // Update application
    await tx.visaApplication.update({
      where: { id: applicationId },
      data: {
        additional_docs_needed: true,
        additional_docs_note: input.note,
      },
    });

    // Log activity
    await logActivity(
      application.order.partner_id,
      'ADDITIONAL_DOCS_REQUESTED',
      `Additional documents requested: ${input.documents.join(', ')}`,
      {
        application_id: applicationId,
        documents: input.documents,
        note: input.note,
        requested_by: opsUserId,
      }
    );

    return { success: true };
  });
}
