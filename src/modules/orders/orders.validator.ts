import { z } from 'zod';

// Create Order validation schema
export const createOrderSchema = z.object({
  visa_variant_id: z.string().uuid('Invalid visa variant ID'),
  order_type: z.enum(['INDIVIDUAL', 'GROUP'], {
    message: 'Order type must be INDIVIDUAL or GROUP',
  }),
  service_mode: z.enum(['SELF_SERVED', 'COMPASS_ASSURED'], {
    message: 'Service mode must be SELF_SERVED or COMPASS_ASSURED',
  }),
  group_name: z.string().max(255, 'Group name too long').optional().nullable(),
});

// Update Travel Dates validation schema
export const updateTravelDatesSchema = z.object({
  travel_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Travel start must be in YYYY-MM-DD format'),
  travel_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Travel end must be in YYYY-MM-DD format'),
  from_country: z.string().max(100, 'From country too long').optional().nullable(),
}).refine(
  (data) => {
    const start = new Date(data.travel_start);
    const end = new Date(data.travel_end);
    return end >= start;
  },
  {
    message: 'Travel end date must be greater than or equal to travel start date',
    path: ['travel_end'],
  }
);

// Confirm Checkout validation schema
export const confirmCheckoutSchema = z.object({
  declarations: z.object({
    tnc: z.boolean(),
    authentic_docs: z.boolean(),
    authorize_processing: z.boolean(),
  }),
});

// List Orders query params
export const listOrdersQuerySchema = z.object({
  status: z.enum(['DRAFT', 'ACTION_REQUIRED', 'READY_TO_PROCEED', 'IN_PROCESS', 'COMPLETED', 'CANCELLED']).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional().default(1),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional().default(20),
});

// Type exports
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateTravelDatesInput = z.infer<typeof updateTravelDatesSchema>;
export type ConfirmCheckoutInput = z.infer<typeof confirmCheckoutSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

/**
 * Generate deterministic order code
 * Format: ORD + 9 digits
 */
export function generateOrderCode(): string {
  // Generate 9 random digits
  const digits = Math.floor(100000000 + Math.random() * 900000000).toString();
  return `ORD${digits}`;
}
