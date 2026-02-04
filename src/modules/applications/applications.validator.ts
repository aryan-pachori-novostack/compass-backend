import { z } from 'zod';

// Create/Update Application validation schema
export const applicationSchema = z.object({
  is_primary_applicant: z.boolean().optional(),
  full_name: z.string().min(1, 'Full name is required').max(255, 'Full name too long'),
  email: z.string().email('Invalid email format').optional().nullable(),
  phone: z.string().max(20, 'Phone number too long').optional().nullable(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format').optional().nullable(),
  nationality: z.string().max(100, 'Nationality too long').optional().nullable(),
  passport_number: z.string().max(50, 'Passport number too long').optional().nullable(),
  passport_issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Passport issue date must be in YYYY-MM-DD format').optional().nullable(),
  passport_expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Passport expiry date must be in YYYY-MM-DD format').optional().nullable(),
  sex: z.string().max(20, 'Sex too long').optional().nullable(),
  place_of_birth: z.string().max(100, 'Place of birth too long').optional().nullable(),
  place_of_issue: z.string().max(100, 'Place of issue too long').optional().nullable(),
  marital_status: z.string().max(50, 'Marital status too long').optional().nullable(),
  mother_name: z.string().max(255, 'Mother name too long').optional().nullable(),
  father_name: z.string().max(255, 'Father name too long').optional().nullable(),
  address: z.string().max(500, 'Address too long').optional().nullable(),
  education: z.string().max(100, 'Education too long').optional().nullable(),
  profession: z.string().max(100, 'Profession too long').optional().nullable(),
});

// Type exports
export type ApplicationInput = z.infer<typeof applicationSchema>;

/**
 * Normalize application data
 */
export function normalizeApplicationData(data: Partial<ApplicationInput>): Partial<ApplicationInput> {
  const normalized: Partial<ApplicationInput> = { ...data };

  if (normalized.full_name) {
    normalized.full_name = normalized.full_name.trim();
  }

  if (normalized.email) {
    normalized.email = normalized.email.toLowerCase().trim();
  }

  if (normalized.passport_number) {
    normalized.passport_number = normalized.passport_number.toUpperCase().trim();
  }

  return normalized;
}

/**
 * Validate passport expiry against travel end date
 */
export function validatePassportExpiry(
  passportExpiry: string | null | undefined,
  travelEnd: Date | null | undefined
): { valid: boolean; error?: string } {
  if (!passportExpiry || !travelEnd) {
    return { valid: true }; // Can't validate if dates not set
  }

  const expiryDate = new Date(passportExpiry);
  const travelEndDate = new Date(travelEnd);

  if (expiryDate <= travelEndDate) {
    return {
      valid: false,
      error: 'Passport expiry date must be after travel end date',
    };
  }

  return { valid: true };
}
