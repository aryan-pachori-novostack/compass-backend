import { z } from 'zod';
import { DocSource } from '@prisma/client';

// Upload Document validation schema
export const uploadDocumentSchema = z.object({
  required_document_id: z.string().uuid('Invalid required document ID').optional().nullable(),
  document_name: z.string().max(255, 'Document name too long').optional().nullable(),
  source: z.enum(['TRAVELLER_UPLOAD', 'OPS_REQUEST', 'SYSTEM_REQUIRED']).optional().default('TRAVELLER_UPLOAD'),
});

// Ops Request Documents validation schema
export const requestDocumentsSchema = z.object({
  note: z.string().max(1000, 'Note too long'),
  documents: z.array(z.string().min(1, 'Document name required').max(255, 'Document name too long')).min(1, 'At least one document required'),
});

// Type exports
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type RequestDocumentsInput = z.infer<typeof requestDocumentsSchema>;
