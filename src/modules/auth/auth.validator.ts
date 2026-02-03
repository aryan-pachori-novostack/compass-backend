import { z } from 'zod';

// Request OTP validation schema
export const requestOtpSchema = z.object({
  channel: z.enum(['EMAIL', 'PHONE'], {
    errorMap: () => ({ message: 'Channel must be either EMAIL or PHONE' }),
  }),
  identifier: z
    .string()
    .min(1, 'Identifier is required')
    .refine(
      (val) => {
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        // Basic phone validation (must start with + and have digits)
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        return emailRegex.test(val) || phoneRegex.test(val);
      },
      {
        message: 'Identifier must be a valid email or phone number with country code (e.g., +1234567890)',
      }
    ),
  purpose: z.enum(['SIGNUP', 'LOGIN'], {
    errorMap: () => ({ message: 'Purpose must be either SIGNUP or LOGIN' }),
  }),
});

// Verify OTP validation schema
export const verifyOtpSchema = z.object({
  channel: z.enum(['EMAIL', 'PHONE'], {
    errorMap: () => ({ message: 'Channel must be either EMAIL or PHONE' }),
  }),
  identifier: z
    .string()
    .min(1, 'Identifier is required')
    .refine(
      (val) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        return emailRegex.test(val) || phoneRegex.test(val);
      },
      {
        message: 'Identifier must be a valid email or phone number with country code',
      }
    ),
  otp: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d+$/, 'OTP must contain only digits'),
  purpose: z.enum(['SIGNUP', 'LOGIN'], {
    errorMap: () => ({ message: 'Purpose must be either SIGNUP or LOGIN' }),
  }),
});

// Type exports
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/**
 * Normalize identifier (trim, lowercase email)
 */
export function normalizeIdentifier(identifier: string, channel: 'EMAIL' | 'PHONE'): string {
  const trimmed = identifier.trim();
  if (channel === 'EMAIL') {
    return trimmed.toLowerCase();
  }
  return trimmed; // Phone numbers keep their format
}

/**
 * Extract country code from phone number
 */
export function extractCountryCode(phone: string): string | null {
  // Phone format: +[country_code][number]
  // Extract country code (typically 1-3 digits after +)
  const match = phone.match(/^\+(\d{1,3})/);
  return match ? match[1] : null;
}
