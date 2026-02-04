import prisma from '../../config/prisma.js';
import { KycStatus, OrderStatus } from '@prisma/client';

export interface ReadinessResult {
  profile_ok: boolean;
  kyc_ok: boolean;
  has_applications: boolean;
  travel_dates_ok: boolean;
  can_checkout: boolean;
  missing: string[];
  suggested_status: OrderStatus;
}

/**
 * Compute order readiness and suggested status
 */
export async function computeOrderReadiness(
  orderId: string,
  partnerId: string
): Promise<ReadinessResult> {
  // Get order with relations
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      travel_start: true,
      travel_end: true,
      partner_id: true,
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

  // Verify ownership
  if (order.partner_id !== partnerId) {
    throw new Error('ORDER_ACCESS_DENIED');
  }

  // Get partner account
  const partner = await prisma.partnerAccount.findUnique({
    where: { id: partnerId },
    select: {
      profile_pct: true,
      kyc_status: true,
    },
  });

  if (!partner) {
    throw new Error('PARTNER_NOT_FOUND');
  }

  const missing: string[] = [];
  let profile_ok = false;
  let kyc_ok = false;
  let has_applications = false;
  let travel_dates_ok = false;

  // Check profile completion
  if (partner.profile_pct >= 80) {
    profile_ok = true;
  } else {
    missing.push('COMPLETE_PROFILE');
  }

  // Check KYC status
  if (partner.kyc_status === KycStatus.SUBMITTED || partner.kyc_status === KycStatus.VERIFIED) {
    kyc_ok = true;
  } else if (partner.kyc_status === KycStatus.REJECTED) {
    missing.push('KYC_REJECTED');
  } else {
    missing.push('COMPLETE_KYC');
  }

  // Check applications
  has_applications = order.applications.length > 0;
  if (!has_applications) {
    missing.push('ADD_TRAVELLER');
  }

  // Check travel dates
  travel_dates_ok = !!(order.travel_start && order.travel_end);
  if (!travel_dates_ok) {
    missing.push('ADD_TRAVEL_DATES');
  }

  // Determine if can checkout
  const can_checkout = profile_ok && kyc_ok && has_applications && travel_dates_ok;

  // Determine suggested status
  let suggested_status: OrderStatus;
  if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.COMPLETED) {
    // Don't change status if already terminal
    suggested_status = order.status;
  } else if (can_checkout) {
    suggested_status = OrderStatus.READY_TO_PROCEED;
  } else {
    suggested_status = OrderStatus.ACTION_REQUIRED;
  }

  return {
    profile_ok,
    kyc_ok,
    has_applications,
    travel_dates_ok,
    can_checkout,
    missing,
    suggested_status,
  };
}
