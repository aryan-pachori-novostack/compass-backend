import {
  PrismaClient,
  OrderStatus,
  OrderType,
  ServiceMode,
  KycStatus,
} from '@prisma/client';
import prisma from '../../config/prisma.js';
import { generateOrderCode } from './orders.validator.js';
import { computeOrderReadiness } from './orders.readiness.js';
import type {
  CreateOrderInput,
  UpdateTravelDatesInput,
  ConfirmCheckoutInput,
} from './orders.validator.js';
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
 * Create Order
 */
export async function createOrder(partnerId: string, input: CreateOrderInput) {
  return await prisma.$transaction(async (tx) => {
    // Validate visa variant exists and is active
    const visaVariant = await tx.visaVariant.findUnique({
      where: { id: input.visa_variant_id },
      include: {
        visa_type: {
          include: {
            country: true,
          },
        },
      },
    });

    if (!visaVariant) {
      throw new Error('VISA_VARIANT_NOT_FOUND');
    }

    if (!visaVariant.is_active) {
      throw new Error('VISA_VARIANT_INACTIVE');
    }

    // Check if country is paused
    if (visaVariant.visa_type.country.is_paused) {
      throw new Error('COUNTRY_PAUSED');
    }

    // Generate order code
    let orderCode = generateOrderCode();
    // Ensure uniqueness (retry if exists)
    let exists = await tx.order.findUnique({ where: { order_code: orderCode } });
    let attempts = 0;
    while (exists && attempts < 10) {
      orderCode = generateOrderCode();
      exists = await tx.order.findUnique({ where: { order_code: orderCode } });
      attempts++;
    }

    if (exists) {
      throw new Error('ORDER_CODE_GENERATION_FAILED');
    }

    // Create order
    const order = await tx.order.create({
      data: {
        order_code: orderCode,
        partner_id: partnerId,
        country_id: visaVariant.visa_type.country.id,
        visa_variant_id: input.visa_variant_id,
        order_type: input.order_type,
        service_mode: input.service_mode,
        group_name: input.group_name || null,
        to_country_name: visaVariant.visa_type.country.name,
        status: OrderStatus.DRAFT,
      },
    });

    // Log activity
    await logActivity(partnerId, 'ORDER_CREATED', `Order created: ${orderCode}`, {
      order_id: order.id,
      order_code: orderCode,
      visa_variant_id: input.visa_variant_id,
    });

    return {
      id: order.id,
      order_code: order.order_code,
      status: order.status,
    };
  });
}

/**
 * List Orders
 */
export async function listOrders(
  partnerId: string,
  status?: OrderStatus,
  page: number = 1,
  limit: number = 20
) {
  const where: { partner_id: string; status?: OrderStatus } = {
    partner_id: partnerId,
  };

  if (status) {
    where.status = status;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        order_code: true,
        status: true,
        total_fee: true,
        fee_currency: true,
        created_at: true,
        country: {
          select: {
            name: true,
          },
        },
        visa_variant: {
          select: {
            variant_name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items: orders.map((order) => ({
      id: order.id,
      order_code: order.order_code,
      status: order.status,
      country: order.country.name,
      visa_variant: order.visa_variant.variant_name,
      total_fee: order.total_fee,
      currency: order.fee_currency,
      created_at: order.created_at,
    })),
    page,
    limit,
    total,
  };
}

/**
 * Get Order Detail
 */
export async function getOrderDetail(orderId: string, partnerId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      country: {
        select: {
          id: true,
          name: true,
          iso_code: true,
          is_paused: true,
        },
      },
      visa_variant: {
        select: {
          id: true,
          variant_name: true,
          entry_type: true,
          duration_days: true,
          currency: true,
          adult_fee: true,
          child_fee: true,
          taxes_fee: true,
        },
      },
      applications: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  if (order.partner_id !== partnerId) {
    throw new Error('ORDER_ACCESS_DENIED');
  }

  // Compute readiness
  const readiness = await computeOrderReadiness(orderId, partnerId);

  return {
    order: {
      id: order.id,
      order_code: order.order_code,
      status: order.status,
      order_type: order.order_type,
      service_mode: order.service_mode,
      group_name: order.group_name,
      travel_start: order.travel_start,
      travel_end: order.travel_end,
      from_country: order.from_country,
      to_country_name: order.to_country_name,
      total_fee: order.total_fee,
      fee_currency: order.fee_currency,
      wallet_used: order.wallet_used,
      created_at: order.created_at,
      updated_at: order.updated_at,
      country: order.country,
      visa_variant: order.visa_variant,
      applications_count: order.applications.length,
    },
    readiness,
  };
}

/**
 * Update Travel Dates
 */
export async function updateTravelDates(
  orderId: string,
  partnerId: string,
  input: UpdateTravelDatesInput
) {
  return await prisma.$transaction(async (tx) => {
    // Verify order exists and ownership
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        partner_id: true,
        status: true,
      },
    });

    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }

    if (order.partner_id !== partnerId) {
      throw new Error('ORDER_ACCESS_DENIED');
    }

    // Update travel dates
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        travel_start: new Date(input.travel_start),
        travel_end: new Date(input.travel_end),
        from_country: input.from_country || null,
      },
    });

    // Recompute readiness and update status
    const readiness = await computeOrderReadiness(orderId, partnerId);

    // Update status if needed
    if (order.status !== readiness.suggested_status && 
        order.status !== OrderStatus.CANCELLED && 
        order.status !== OrderStatus.COMPLETED) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: readiness.suggested_status },
      });
    }

    // Log activity
    await logActivity(partnerId, 'ORDER_UPDATED', 'Travel dates updated', {
      order_id: orderId,
      travel_start: input.travel_start,
      travel_end: input.travel_end,
    });

    return {
      status: readiness.suggested_status,
      readiness,
    };
  });
}

/**
 * Checkout Preview
 */
export async function getCheckoutPreview(orderId: string, partnerId: string) {
  // Get order with relations
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      visa_variant: {
        select: {
          adult_fee: true,
          child_fee: true,
          taxes_fee: true,
          currency: true,
        },
      },
      country: {
        select: {
          is_paused: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  if (order.partner_id !== partnerId) {
    throw new Error('ORDER_ACCESS_DENIED');
  }

  // Get partner account
  const partner = await prisma.partnerAccount.findUnique({
    where: { id: partnerId },
    select: {
      profile_pct: true,
      kyc_status: true,
      wallet: {
        select: {
          balance: true,
          currency: true,
        },
      },
    },
  });

  if (!partner) {
    throw new Error('PARTNER_NOT_FOUND');
  }

  // Check gating
  const profile_ok = partner.profile_pct >= 80;
  const kyc_ok = partner.kyc_status === KycStatus.SUBMITTED || partner.kyc_status === KycStatus.VERIFIED;
  const allowed = profile_ok && kyc_ok && !order.country.is_paused;

  const missing: string[] = [];
  if (!profile_ok) missing.push('COMPLETE_PROFILE');
  if (!kyc_ok) {
    if (partner.kyc_status === KycStatus.REJECTED) {
      missing.push('KYC_REJECTED');
    } else {
      missing.push('COMPLETE_KYC');
    }
  }
  if (order.country.is_paused) missing.push('COUNTRY_PAUSED');

  // Calculate fees (use variant fees, not order snapshot yet)
  const baseFee = order.visa_variant.adult_fee || 0;
  const taxes = order.visa_variant.taxes_fee || 0;
  const total = baseFee + taxes;
  const currency = order.visa_variant.currency;

  // Get wallet balance
  const walletBalance = partner.wallet?.balance || 0;
  const walletCurrency = partner.wallet?.currency || 'INR';

  // Calculate payable
  const viaWallet = Math.min(walletBalance, total);
  const remaining = Math.max(0, total - viaWallet);

  // Static declarations
  const declarations = [
    'I confirm documents are authentic',
    'I accept Terms & Conditions',
    'I authorize processing of visa application',
  ];

  return {
    gating: {
      profile_pct: partner.profile_pct,
      kyc_status: partner.kyc_status,
      allowed,
      missing,
    },
    wallet: {
      balance: walletBalance,
      currency: walletCurrency,
    },
    fee: {
      base: baseFee,
      taxes,
      total,
      currency,
    },
    payable: {
      via_wallet: viaWallet,
      remaining,
    },
    declarations,
  };
}

/**
 * Confirm Checkout
 */
export async function confirmCheckout(
  orderId: string,
  partnerId: string,
  input: ConfirmCheckoutInput
) {
  return await prisma.$transaction(async (tx) => {
    // Get order with relations
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        visa_variant: {
          select: {
            adult_fee: true,
            child_fee: true,
            taxes_fee: true,
            currency: true,
          },
        },
        country: {
          select: {
            is_paused: true,
          },
        },
        applications: {
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }

    if (order.partner_id !== partnerId) {
      throw new Error('ORDER_ACCESS_DENIED');
    }

    // Check if already confirmed (idempotency)
    if (order.tnc_accepted_at && order.declarations) {
      return {
        status: order.status,
        total_fee: order.total_fee,
        currency: order.fee_currency,
      };
    }

    // Get partner for gating validation
    const partner = await tx.partnerAccount.findUnique({
      where: { id: partnerId },
      select: {
        profile_pct: true,
        kyc_status: true,
      },
    });

    if (!partner) {
      throw new Error('PARTNER_NOT_FOUND');
    }

    // Validate gating
    if (partner.profile_pct < 80) {
      throw new Error('PROFILE_INCOMPLETE');
    }

    if (partner.kyc_status !== KycStatus.SUBMITTED && partner.kyc_status !== KycStatus.VERIFIED) {
      throw new Error('KYC_NOT_READY');
    }

    // Validate country not paused
    if (order.country.is_paused) {
      throw new Error('COUNTRY_PAUSED');
    }

    // Validate has applications
    if (order.applications.length === 0) {
      throw new Error('NO_APPLICATIONS');
    }

    // Calculate fee snapshot
    const baseFee = order.visa_variant.adult_fee || 0;
    const taxes = order.visa_variant.taxes_fee || 0;
    const totalFee = baseFee + taxes;
    const currency = order.visa_variant.currency;

    // Recompute readiness
    const readiness = await computeOrderReadiness(orderId, partnerId);

    // Update order with snapshot and declarations
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        total_fee: totalFee,
        fee_currency: currency,
        declarations: input.declarations as any,
        tnc_accepted_at: new Date(),
        status: readiness.suggested_status,
      },
    });

    // Log activity
    await logActivity(partnerId, 'ORDER_CHECKOUT_CONFIRMED', 'Checkout confirmed', {
      order_id: orderId,
      total_fee: totalFee,
      currency,
    });

    return {
      status: updated.status,
      total_fee: updated.total_fee,
      currency: updated.fee_currency,
    };
  });
}

/**
 * Cancel Order
 */
export async function cancelOrder(orderId: string, partnerId: string) {
  return await prisma.$transaction(async (tx) => {
    // Verify order exists and ownership
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        partner_id: true,
        status: true,
        order_code: true,
      },
    });

    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }

    if (order.partner_id !== partnerId) {
      throw new Error('ORDER_ACCESS_DENIED');
    }

    // Check if cancellation is allowed
    const cancellableStatuses: OrderStatus[] = [
      OrderStatus.DRAFT,
      OrderStatus.ACTION_REQUIRED,
      OrderStatus.READY_TO_PROCEED,
    ];

    if (!cancellableStatuses.includes(order.status)) {
      throw new Error('ORDER_CANNOT_BE_CANCELLED');
    }

    // Update status
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
      },
    });

    // Log activity
    await logActivity(partnerId, 'ORDER_CANCELLED', `Order cancelled: ${order.order_code}`, {
      order_id: orderId,
      order_code: order.order_code,
    });

    return {
      id: updated.id,
      order_code: updated.order_code,
      status: updated.status,
    };
  });
}
