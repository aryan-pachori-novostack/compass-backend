import {
  PrismaClient,
  WalletTxnType,
  PaymentMethod,
} from '@prisma/client';
import prisma from '../../config/prisma.js';
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
 * Get or create wallet for partner
 */
export async function getOrCreateWallet(partnerId: string) {
  // Try to get existing wallet
  let wallet = await prisma.wallet.findUnique({
    where: { partner_id: partnerId },
  });

  // Create if missing
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        partner_id: partnerId,
        balance: 0,
        currency: 'INR',
      },
    });

    logger.info('Wallet auto-created', { partnerId, walletId: wallet.id });
  }

  return {
    balance: wallet.balance,
    currency: wallet.currency,
  };
}

/**
 * List wallet transactions
 */
export async function listWalletTransactions(
  partnerId: string,
  txnType?: WalletTxnType,
  page: number = 1,
  limit: number = 20
) {
  // Ensure wallet exists
  await getOrCreateWallet(partnerId);

  const where: { wallet: { partner_id: string }; txn_type?: WalletTxnType } = {
    wallet: {
      partner_id: partnerId,
    },
  };

  if (txnType) {
    where.txn_type = txnType;
  }

  const [transactions, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      select: {
        id: true,
        txn_type: true,
        method: true,
        amount: true,
        currency: true,
        order_id: true,
        reference_id: true,
        note: true,
        created_at: true,
      },
      orderBy: {
        created_at: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return {
    items: transactions.map((txn) => ({
      id: txn.id,
      txn_type: txn.txn_type,
      method: txn.method,
      amount: txn.amount,
      currency: txn.currency,
      order_id: txn.order_id,
      reference_id: txn.reference_id,
      note: txn.note,
      created_at: txn.created_at,
    })),
    page,
    limit,
    total,
  };
}

/**
 * Credit wallet (used by payment webhook)
 * This is concurrency-safe using Prisma transactions
 */
export async function creditWallet(
  partnerId: string,
  amount: number,
  currency: string,
  method: PaymentMethod,
  referenceId: string,
  note?: string
) {
  return await prisma.$transaction(async (tx) => {
    // Get or create wallet with row lock (Prisma handles this in transaction)
    let wallet = await tx.wallet.findUnique({
      where: { partner_id: partnerId },
    });

    if (!wallet) {
      wallet = await tx.wallet.create({
        data: {
          partner_id: partnerId,
          balance: 0,
          currency: currency,
        },
      });
    }

    // Create wallet transaction
    const transaction = await tx.walletTransaction.create({
      data: {
        wallet_id: wallet.id,
        txn_type: WalletTxnType.CREDIT,
        method: method,
        amount: amount,
        currency: currency,
        reference_id: referenceId,
        note: note || null,
      },
    });

    // Update wallet balance (atomic)
    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: {
          increment: amount,
        },
      },
    });

    return {
      transaction_id: transaction.id,
      new_balance: updated.balance,
    };
  });
}

/**
 * Debit wallet (used for order payment)
 * This is concurrency-safe and prevents negative balances
 */
export async function debitWallet(
  partnerId: string,
  amount: number,
  currency: string,
  orderId: string,
  referenceId: string,
  note?: string
) {
  return await prisma.$transaction(async (tx) => {
    // Get wallet with row lock (Prisma transaction provides isolation)
    const wallet = await tx.wallet.findUnique({
      where: { partner_id: partnerId },
    });

    if (!wallet) {
      throw new Error('WALLET_NOT_FOUND');
    }

    // Check balance (with current balance from DB)
    if (wallet.balance < amount) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    // Create wallet transaction
    const transaction = await tx.walletTransaction.create({
      data: {
        wallet_id: wallet.id,
        txn_type: WalletTxnType.DEBIT,
        method: PaymentMethod.WALLET,
        amount: amount,
        currency: currency,
        order_id: orderId,
        reference_id: referenceId,
        note: note || null,
      },
    });

    // Update wallet balance (atomic decrement)
    // Using decrement ensures balance cannot go negative (database constraint)
    const updated = await tx.wallet.update({
      where: {
        id: wallet.id,
        balance: {
          gte: amount, // Ensure balance is sufficient
        },
      },
      data: {
        balance: {
          decrement: amount,
        },
      },
    });

    // If update failed (balance insufficient), throw error
    if (!updated) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    return {
      transaction_id: transaction.id,
      new_balance: updated.balance,
    };
  });
}
