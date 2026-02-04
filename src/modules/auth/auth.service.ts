import { PrismaClient, AuthChannel, OtpPurpose, PartnerType, KycStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import prisma from '../../config/prisma.js';
import {
  normalizeIdentifier,
  extractCountryCode,
  type RequestOtpInput,
  type VerifyOtpInput,
} from './auth.validator.js';

// OTP expiry time: 5 minutes
const OTP_EXPIRY_MINUTES = 5;
const OTP_LENGTH = 6;

/**
 * Generate a random 6-digit OTP
 */
function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hash OTP using bcrypt
 */
async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

/**
 * Compare OTP with hash
 */
async function compareOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

/**
 * Generate JWT token
 */
function generateJwtToken(partnerId: string): string {
  const payload = {
    partnerId,
    role: 'PARTNER',
  };
  
  return jwt.sign(payload, env.jwt_secret, {
    expiresIn: env.jwt_expires_in,
  } as jwt.SignOptions);
}

/**
 * Request OTP service
 */
export async function requestOtp(input: RequestOtpInput, clientIp: string): Promise<{ expires_in: number }> {
  const normalizedIdentifier = normalizeIdentifier(input.identifier, input.channel);

  // Invalidate all previous unverified OTPs for this identifier and purpose
  await prisma.authOtp.updateMany({
    where: {
      identifier: normalizedIdentifier,
      purpose: input.purpose,
      verified_at: null,
      expires_at: {
        gt: new Date(),
      },
    },
    data: {
      expires_at: new Date(), // Expire them immediately
    },
  });

  // Generate OTP
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);

  // Calculate expiry
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

  // Check if partner exists (for LOGIN purpose validation)
  if (input.purpose === 'LOGIN') {
    const whereClause =
      input.channel === 'EMAIL'
        ? { email: normalizedIdentifier }
        : { phone: normalizedIdentifier };

    const existingPartner = await prisma.partnerAccount.findFirst({
      where: whereClause,
    });

    if (!existingPartner) {
      throw new Error('PARTNER_NOT_FOUND');
    }
  }

  // Create AuthOtp record
  await prisma.authOtp.create({
    data: {
      channel: input.channel,
      identifier: normalizedIdentifier,
      purpose: input.purpose,
      otp_hash: otpHash,
      expires_at: expiresAt,
    },
  });

  // TODO: Send OTP via email/SMS service (mock for now)
  // In production, integrate with email/SMS service here
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] OTP for ${normalizedIdentifier}: ${otp}`);
  }

  return {
    expires_in: OTP_EXPIRY_MINUTES * 60, // seconds
  };
}

/**
 * Verify OTP service
 */
export async function verifyOtp(
  input: VerifyOtpInput
): Promise<{ token: string; partner: { id: string; partner_type: PartnerType; kyc_status: KycStatus; profile_pct: number } }> {
  const normalizedIdentifier = normalizeIdentifier(input.identifier, input.channel);

  // Find the most recent unverified OTP
  const authOtp = await prisma.authOtp.findFirst({
    where: {
      identifier: normalizedIdentifier,
      purpose: input.purpose,
      channel: input.channel,
      verified_at: null,
      expires_at: {
        gt: new Date(),
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  if (!authOtp) {
    throw new Error('OTP_NOT_FOUND_OR_EXPIRED');
  }

  // Verify OTP hash
  const isValid = await compareOtp(input.otp, authOtp.otp_hash);
  if (!isValid) {
    throw new Error('INVALID_OTP');
  }

  // Check if OTP was already verified (race condition protection)
  if (authOtp.verified_at) {
    throw new Error('OTP_ALREADY_VERIFIED');
  }

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Mark OTP as verified
    await tx.authOtp.update({
      where: { id: authOtp.id },
      data: { verified_at: new Date() },
    });

    // Find or create PartnerAccount
    const whereClause =
      input.channel === 'EMAIL'
        ? { email: normalizedIdentifier }
        : { phone: normalizedIdentifier };

    let partner = await tx.partnerAccount.findFirst({
      where: whereClause,
    });

    if (!partner) {
      // Create new partner account
      const countryCode = input.channel === 'PHONE' ? extractCountryCode(normalizedIdentifier) : null;

      partner = await tx.partnerAccount.create({
        data: {
          partner_type: PartnerType.INDIVIDUAL,
          email: input.channel === 'EMAIL' ? normalizedIdentifier : null,
          phone: input.channel === 'PHONE' ? normalizedIdentifier : null,
          country_code: countryCode,
          kyc_status: KycStatus.NOT_STARTED,
          profile_pct: 0,
          is_active: true,
        },
      });
    } else {
      // Update last login
      await tx.partnerAccount.update({
        where: { id: partner.id },
        data: { last_login_at: new Date() },
      });
    }

    // Update AuthOtp with partner_id
    await tx.authOtp.update({
      where: { id: authOtp.id },
      data: { partner_id: partner.id },
    });

    return partner;
  });

  // Generate JWT token
  const token = generateJwtToken(result.id);

  return {
    token,
    partner: {
      id: result.id,
      partner_type: result.partner_type,
      kyc_status: result.kyc_status,
      profile_pct: result.profile_pct,
    },
  };
}

/**
 * Get current partner from JWT
 */
export async function getCurrentPartner(partnerId: string) {
  const partner = await prisma.partnerAccount.findUnique({
    where: { id: partnerId },
    select: {
      id: true,
      email: true,
      phone: true,
      partner_type: true,
      kyc_status: true,
      profile_pct: true,
      is_active: true,
      created_at: true,
    },
  });

  if (!partner) {
    throw new Error('PARTNER_NOT_FOUND');
  }

  if (!partner.is_active) {
    throw new Error('PARTNER_INACTIVE');
  }

  return partner;
}
