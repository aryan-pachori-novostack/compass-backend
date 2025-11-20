import prisma from '../../config/prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  partner: {
    partner_account_id: string;
    email: string;
    partner_type: 'COMPANY' | 'INDIVIDUAL';
    is_active: boolean;
    kyc_verified: boolean;
  };
}

class AuthService {
  async login(input: LoginInput): Promise<LoginResponse> {
    try {
      // Validate input
      if (!input.email || input.email.trim().length === 0) {
        throw new Error('email is required');
      }

      // Basic email format validation
      const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email_regex.test(input.email.trim())) {
        throw new Error('Invalid email format');
      }

      if (!input.password || input.password.trim().length === 0) {
        throw new Error('password is required');
      }

      if (input.password.length < 6) {
        throw new Error('password must be at least 6 characters long');
      }

      // Find partner account by email
      const partner_account = await prisma.partnerAccount.findUnique({
        where: {
          email: input.email.trim().toLowerCase(),
        },
      });

      if (!partner_account) {
        throw new Error('Invalid email or password');
      }

      // Check if account is active
      if (!partner_account.is_active) {
        throw new Error('Account is inactive. Please contact support.');
      }

      // Compare password
      const is_password_valid = await bcrypt.compare(input.password, partner_account.password_hash);

      if (!is_password_valid) {
        throw new Error('Invalid email or password');
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          partner_account_id: partner_account.partner_account_id,
          email: partner_account.email,
          partner_type: partner_account.partner_type,
        },
        env.jwt_secret,
        {
          expiresIn: env.jwt_expires_in as string,
        } as jwt.SignOptions
      );

      return {
        token,
        partner: {
          partner_account_id: partner_account.partner_account_id,
          email: partner_account.email,
          partner_type: partner_account.partner_type,
          is_active: partner_account.is_active,
          kyc_verified: partner_account.kyc_verified,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to login: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default new AuthService();

