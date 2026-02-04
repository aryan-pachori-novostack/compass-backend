import {
  PrismaClient,
  EntityType,
  GstStatus,
  KycStatus,
  KycDocType,
  DocStatus,
} from '@prisma/client';
import prisma from '../../config/prisma.js';
import { upload_to_s3, get_signed_url } from '../../utils/s3.js';
import logger from '../../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { UpdateProfileInput, UploadKycDocumentInput, VerifyKycDocumentInput } from './partner.validator.js';
import { normalizePan, normalizeGst, normalizeAadhaar } from './partner.validator.js';

// Mandatory KYC documents
const MANDATORY_DOC_TYPES: KycDocType[] = [
  'PAN',
  'AADHAAR_FRONT',
  'AADHAAR_BACK',
];

/**
 * Calculate profile completion percentage
 */
function calculateProfilePct(profile: {
  entity_type: EntityType | null;
  entity_name: string | null;
  pan_number: string | null;
  aadhaar_number: string | null;
  gst_status: GstStatus | null;
  gst_number: string | null;
  registered_address: string | null;
  hasKycDocuments: boolean;
}): number {
  let pct = 0;

  if (profile.entity_type) pct += 10;
  if (profile.entity_name) pct += 10;
  if (profile.pan_number) pct += 15;
  if (profile.aadhaar_number) pct += 15;
  if (profile.gst_status) pct += 10;
  if (profile.gst_status === 'REGISTERED' && profile.gst_number) pct += 10;
  if (profile.registered_address) pct += 10;
  if (profile.hasKycDocuments) pct += 20;

  return Math.min(pct, 100);
}

/**
 * Derive KYC status based on documents
 */
export async function deriveKycStatus(partnerId: string): Promise<KycStatus> {
  const documents = await prisma.partnerKycDocument.findMany({
    where: { partner_id: partnerId },
  });

  if (documents.length === 0) {
    return KycStatus.NOT_STARTED;
  }

  const hasSubmitted = documents.some((doc) => doc.status === DocStatus.VERIFIED || doc.status === DocStatus.REJECTED);
  
  // Check if all mandatory documents are verified
  const mandatoryDocs = documents.filter((doc) => MANDATORY_DOC_TYPES.includes(doc.doc_type));
  const allMandatoryVerified = mandatoryDocs.length === MANDATORY_DOC_TYPES.length &&
    mandatoryDocs.every((doc) => doc.status === DocStatus.VERIFIED);

  // Check if any document is rejected
  const hasRejected = documents.some((doc) => doc.status === DocStatus.REJECTED);

  if (hasRejected) {
    return KycStatus.REJECTED;
  }

  if (allMandatoryVerified && hasSubmitted) {
    return KycStatus.VERIFIED;
  }

  // Check if KYC was submitted (has any verified/rejected documents)
  const account = await prisma.partnerAccount.findUnique({
    where: { id: partnerId },
    select: { kyc_status: true },
  });

  if (account?.kyc_status === KycStatus.SUBMITTED) {
    return KycStatus.SUBMITTED;
  }

  return KycStatus.IN_PROGRESS;
}

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
 * Get partner profile
 */
export async function getPartnerProfile(partnerId: string) {
  const account = await prisma.partnerAccount.findUnique({
    where: { id: partnerId },
    include: {
      profile: true,
    },
  });

  if (!account) {
    throw new Error('PARTNER_NOT_FOUND');
  }

  return {
    account: {
      partner_type: account.partner_type,
      kyc_status: account.kyc_status,
      profile_pct: account.profile_pct,
    },
    profile: account.profile
      ? {
          entity_type: account.profile.entity_type,
          entity_name: account.profile.entity_name,
          first_name: account.profile.first_name,
          last_name: account.profile.last_name,
          contact_email: account.profile.contact_email,
          contact_phone: account.profile.contact_phone,
          pan_number: account.profile.pan_number,
          aadhaar_number: account.profile.aadhaar_number,
          gst_status: account.profile.gst_status,
          gst_number: account.profile.gst_number,
          registered_address: account.profile.registered_address,
        }
      : null,
  };
}

/**
 * Update partner profile
 */
export async function updatePartnerProfile(partnerId: string, input: UpdateProfileInput) {
  // Validate GST number if GST status is REGISTERED
  if (input.gst_status === 'REGISTERED' && !input.gst_number) {
    throw new Error('GST_NUMBER_REQUIRED');
  }

  // Normalize fields
  const normalizedPan = normalizePan(input.pan_number);
  const normalizedGst = normalizeGst(input.gst_number);
  const normalizedAadhaar = normalizeAadhaar(input.aadhaar_number);

  return await prisma.$transaction(async (tx) => {
    // Upsert profile
    const profile = await tx.partnerProfile.upsert({
      where: { partner_id: partnerId },
      update: {
        entity_type: input.entity_type,
        entity_name: input.entity_name,
        first_name: input.first_name || null,
        last_name: input.last_name || null,
        contact_email: input.contact_email || null,
        contact_phone: input.contact_phone || null,
        pan_number: normalizedPan,
        aadhaar_number: normalizedAadhaar,
        gst_status: input.gst_status || null,
        gst_number: normalizedGst,
        registered_address: input.registered_address || null,
      },
      create: {
        partner_id: partnerId,
        entity_type: input.entity_type,
        entity_name: input.entity_name,
        first_name: input.first_name || null,
        last_name: input.last_name || null,
        contact_email: input.contact_email || null,
        contact_phone: input.contact_phone || null,
        pan_number: normalizedPan,
        aadhaar_number: normalizedAadhaar,
        gst_status: input.gst_status || null,
        gst_number: normalizedGst,
        registered_address: input.registered_address || null,
      },
    });

    // Check if partner has KYC documents
    const hasKycDocuments = await tx.partnerKycDocument.count({
      where: { partner_id: partnerId },
    }) > 0;

    // Calculate profile percentage
    const profilePct = calculateProfilePct({
      entity_type: profile.entity_type,
      entity_name: profile.entity_name,
      pan_number: profile.pan_number,
      aadhaar_number: profile.aadhaar_number,
      gst_status: profile.gst_status,
      gst_number: profile.gst_number,
      registered_address: profile.registered_address,
      hasKycDocuments,
    });

    // Get current KYC status
    const account = await tx.partnerAccount.findUnique({
      where: { id: partnerId },
      select: { kyc_status: true },
    });

    // If KYC was SUBMITTED or VERIFIED, revert to IN_PROGRESS on profile update
    let newKycStatus = account?.kyc_status;
    if (account?.kyc_status === KycStatus.SUBMITTED || account?.kyc_status === KycStatus.VERIFIED) {
      newKycStatus = KycStatus.IN_PROGRESS;
    } else if (newKycStatus === KycStatus.NOT_STARTED) {
      newKycStatus = KycStatus.IN_PROGRESS;
    }

    // Update partner account
    await tx.partnerAccount.update({
      where: { id: partnerId },
      data: {
        profile_pct: profilePct,
        kyc_status: newKycStatus || KycStatus.IN_PROGRESS,
      },
    });

    // Log activity
    await logActivity(partnerId, 'PROFILE_UPDATED', 'Partner profile updated', {
      profile_pct: profilePct,
      kyc_status: newKycStatus,
    });

    return { profile_pct: profilePct };
  });
}

/**
 * Get KYC documents
 */
export async function getKycDocuments(partnerId: string) {
  const documents = await prisma.partnerKycDocument.findMany({
    where: { partner_id: partnerId },
    orderBy: { uploaded_at: 'desc' },
  });

  // Generate signed URLs for file access
  const documentsWithUrls = await Promise.all(
    documents.map(async (doc) => {
      let fileUrl = doc.file_url;
      try {
        // If it's an S3 URL, generate signed URL
        // Extract S3 key from URL
        if (doc.file_url.startsWith('s3://')) {
          const s3Key = doc.file_url.replace(/^s3:\/\/[^/]+\//, '');
          fileUrl = await get_signed_url(s3Key, 3600);
        } else if (doc.file_url.includes('amazonaws.com')) {
          // Try to extract key from URL
          try {
            const url = new URL(doc.file_url);
            const s3Key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
            fileUrl = await get_signed_url(s3Key, 3600);
          } catch {
            // If URL parsing fails, use original
            fileUrl = doc.file_url;
          }
        }
      } catch (error) {
        // If signed URL generation fails, use original URL
        logger.warn('Failed to generate signed URL:', { error, file_url: doc.file_url });
      }

      return {
        id: doc.id,
        doc_type: doc.doc_type,
        status: doc.status,
        file_url: fileUrl,
        is_mandatory: doc.is_mandatory,
        verification_notes: doc.verification_notes,
        uploaded_at: doc.uploaded_at,
        verified_at: doc.verified_at,
      };
    })
  );

  return documentsWithUrls;
}

/**
 * Upload KYC document
 */
export async function uploadKycDocument(
  partnerId: string,
  docType: KycDocType,
  filePath: string,
  originalFileName: string
) {
  // Generate unique S3 key
  const fileExt = path.extname(originalFileName);
  const fileName = `${partnerId}/kyc/${docType}_${crypto.randomUUID()}${fileExt}`;
  const s3Key = `partners/${fileName}`;

  return await prisma.$transaction(async (tx) => {
    // Upload to S3
    let s3Url: string;
    try {
      const result = await upload_to_s3({
        file_path: filePath,
        s3_key: s3Key,
        content_type: 'application/pdf', // Default to PDF, can be enhanced
      });
      s3Url = result.s3_url;
    } catch (error) {
      // If S3 upload fails, store local path (for development)
      s3Url = filePath;
      console.warn('S3 upload failed, using local path:', error);
    }

    // Check if document of this type already exists
    const existingDoc = await tx.partnerKycDocument.findFirst({
      where: {
        partner_id: partnerId,
        doc_type: docType,
      },
    });

    // Delete old document from S3 if exists
    if (existingDoc) {
      try {
        // Delete old file from S3 if it's an S3 URL
        if (existingDoc.file_url.startsWith('s3://')) {
          // Note: Would need delete_from_s3 function, but keeping it simple for now
        }
      } catch (error) {
        console.error('Failed to delete old document:', error);
      }

      // Update existing document
      await tx.partnerKycDocument.update({
        where: { id: existingDoc.id },
        data: {
          file_url: s3Url,
          status: DocStatus.UPLOADED,
          verification_notes: null,
          verified_at: null,
          uploaded_at: new Date(),
        },
      });
    } else {
      // Create new document
      await tx.partnerKycDocument.create({
        data: {
          partner_id: partnerId,
          doc_type: docType,
          file_url: s3Url,
          is_mandatory: MANDATORY_DOC_TYPES.includes(docType),
          status: DocStatus.UPLOADED,
        },
      });
    }

    // Update KYC status to IN_PROGRESS
    const account = await tx.partnerAccount.findUnique({
      where: { id: partnerId },
      select: { kyc_status: true },
    });

    if (account?.kyc_status === KycStatus.NOT_STARTED || account?.kyc_status === KycStatus.SUBMITTED) {
      await tx.partnerAccount.update({
        where: { id: partnerId },
        data: { kyc_status: KycStatus.IN_PROGRESS },
      });
    }

    // Log activity
    await logActivity(partnerId, 'KYC_DOCUMENT_UPLOADED', `KYC document uploaded: ${docType}`, {
      doc_type: docType,
    });

    // Clean up temp file
    try {
      if (fs.existsSync(filePath) && !filePath.startsWith('s3://')) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Failed to delete temp file:', error);
    }
  });
}

/**
 * Submit KYC for verification
 */
export async function submitKyc(partnerId: string) {
  return await prisma.$transaction(async (tx) => {
    // Get all documents
    const documents = await tx.partnerKycDocument.findMany({
      where: { partner_id: partnerId },
    });

    // Check mandatory documents
    const hasPan = documents.some((doc) => doc.doc_type === 'PAN');
    const hasAadhaarFront = documents.some((doc) => doc.doc_type === 'AADHAAR_FRONT');
    const hasAadhaarBack = documents.some((doc) => doc.doc_type === 'AADHAAR_BACK');

    if (!hasPan || !hasAadhaarFront || !hasAadhaarBack) {
      throw new Error('MANDATORY_DOCUMENTS_MISSING');
    }

    // Check GST certificate if registered
    const profile = await tx.partnerProfile.findUnique({
      where: { partner_id: partnerId },
      select: { gst_status: true },
    });

    if (profile?.gst_status === 'REGISTERED') {
      const hasGstCert = documents.some((doc) => doc.doc_type === 'GST_CERTIFICATE');
      if (!hasGstCert) {
        throw new Error('GST_CERTIFICATE_REQUIRED');
      }
    }

    // Update KYC status to SUBMITTED
    await tx.partnerAccount.update({
      where: { id: partnerId },
      data: { kyc_status: KycStatus.SUBMITTED },
    });

    // Log activity
    await logActivity(partnerId, 'KYC_SUBMITTED', 'KYC submitted for verification');

    return { kyc_status: KycStatus.SUBMITTED };
  });
}

/**
 * Verify/Reject KYC document (OPS only)
 */
export async function verifyKycDocument(
  documentId: string,
  input: VerifyKycDocumentInput,
  opsUserId: string
) {
  return await prisma.$transaction(async (tx) => {
    // Get document
    const document = await tx.partnerKycDocument.findUnique({
      where: { id: documentId },
      include: {
        partner: {
          select: { id: true, kyc_status: true },
        },
      },
    });

    if (!document) {
      throw new Error('DOCUMENT_NOT_FOUND');
    }

    // Update document status
    await tx.partnerKycDocument.update({
      where: { id: documentId },
      data: {
        status: input.status === 'VERIFIED' ? DocStatus.VERIFIED : DocStatus.REJECTED,
        verification_notes: input.notes || null,
        verified_at: new Date(),
      },
    });

    // Derive new KYC status
    const newKycStatus = await deriveKycStatus(document.partner_id);

    // Update partner account KYC status
    await tx.partnerAccount.update({
      where: { id: document.partner_id },
      data: { kyc_status: newKycStatus },
    });

    // Log activity
    const eventType = input.status === 'VERIFIED' ? 'KYC_DOCUMENT_VERIFIED' : 'KYC_DOCUMENT_REJECTED';
    await logActivity(document.partner_id, eventType, `KYC document ${input.status.toLowerCase()}: ${document.doc_type}`, {
      document_id: documentId,
      doc_type: document.doc_type,
      status: input.status,
      verified_by: opsUserId,
    });

    return {
      document_id: documentId,
      status: input.status,
      kyc_status: newKycStatus,
    };
  });
}
