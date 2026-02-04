import { z } from 'zod';

// Update Profile validation schema
export const updateProfileSchema = z.object({
  entity_type: z.enum(['SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PVT_LTD', 'OPC', 'OTHER'], {
    message: 'Invalid entity type',
  }),
  entity_name: z.string().min(1, 'Entity name is required').max(255, 'Entity name too long'),
  first_name: z.string().max(100, 'First name too long').optional(),
  last_name: z.string().max(100, 'Last name too long').optional(),
  contact_email: z.string().email('Invalid email format').optional().nullable(),
  contact_phone: z.string().max(20, 'Phone number too long').optional().nullable(),
  pan_number: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'PAN must be in format ABCDE1234F')
    .optional()
    .nullable(),
  aadhaar_number: z
    .string()
    .regex(/^\d{4}[\s-]?\d{4}[\s-]?\d{4}$/, 'Aadhaar must be 12 digits')
    .optional()
    .nullable(),
  gst_status: z.enum(['REGISTERED', 'NOT_REGISTERED'], {
    message: 'GST status must be REGISTERED or NOT_REGISTERED',
  }).optional().nullable(),
  gst_number: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST number format')
    .optional()
    .nullable(),
  registered_address: z.string().max(500, 'Address too long').optional().nullable(),
});

// Upload KYC Document validation
export const uploadKycDocumentSchema = z.object({
  doc_type: z.enum([
    'PAN',
    'AADHAAR_FRONT',
    'AADHAAR_BACK',
    'GST_CERTIFICATE',
    'CANCELLED_CHEQUE',
    'INCORPORATION_CERT',
    'MOA',
    'AOA',
    'BOARD_RESOLUTION',
    'OTHER',
  ], {
    message: 'Invalid document type',
  }),
});

// Verify KYC Document (OPS) validation
export const verifyKycDocumentSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED'], {
    message: 'Status must be VERIFIED or REJECTED',
  }),
  notes: z.string().max(1000, 'Notes too long').optional().nullable(),
});

// Type exports
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UploadKycDocumentInput = z.infer<typeof uploadKycDocumentSchema>;
export type VerifyKycDocumentInput = z.infer<typeof verifyKycDocumentSchema>;

/**
 * Normalize PAN number (uppercase, no spaces)
 */
export function normalizePan(pan: string | null | undefined): string | null {
  if (!pan) return null;
  return pan.replace(/\s+/g, '').toUpperCase();
}

/**
 * Normalize GST number (uppercase, no spaces)
 */
export function normalizeGst(gst: string | null | undefined): string | null {
  if (!gst) return null;
  return gst.replace(/\s+/g, '').toUpperCase();
}

/**
 * Normalize Aadhaar number (remove spaces and hyphens)
 */
export function normalizeAadhaar(aadhaar: string | null | undefined): string | null {
  if (!aadhaar) return null;
  return aadhaar.replace(/[\s-]/g, '');
}
