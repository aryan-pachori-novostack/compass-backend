import {
  PrismaClient,
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
  WalletTxnType,
} from '@prisma/client';
import prisma from '../../config/prisma.js';
import { paymentGateway } from './payment.gateway.js';
import { creditWallet } from '../wallet/wallet.service.js';
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
 * Initiate Wallet Top-up
 */
export async function initiateWalletTopup(
  partnerId: string,
  amount: number,
  method: PaymentMethod
) {
  // Validate minimum amount
  const MIN_AMOUNT = 10;
  if (amount < MIN_AMOUNT) {
    throw new Error('AMOUNT_TOO_LOW');
  }

  return await prisma.$transaction(async (tx) => {
      // Create payment record
    // For top-up, we use a dummy order_id or empty string
    // Since schema requires order_id, we'll use a placeholder
    // In production, Payment should have optional order_id or separate top-up table
    // Workaround: Create a dummy order_id or use a special value
    const DUMMY_ORDER_ID = '00000000-0000-0000-0000-000000000000';
    
    const payment = await tx.payment.create({
      data: {
        order_id: DUMMY_ORDER_ID, // Dummy order_id for top-up
        method: method,
        amount: amount,
        currency: 'INR',
        status: PaymentStatus.INITIATED,
        gateway_payload: {
          purpose: 'WALLET_TOPUP',
          partner_id: partnerId,
        } as any,
      },
    });

    // Call payment gateway
    try {
      const gatewayResult = await paymentGateway.createPayment({
        amount: amount,
        currency: 'INR',
        partnerId: partnerId,
        purpose: 'WALLET_TOPUP',
        referenceId: payment.payment_code,
        metadata: {
          payment_id: payment.id,
          payment_code: payment.payment_code,
          partner_id: partnerId,
        },
      });

      // Update payment with gateway transaction ID
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          gateway_txn_id: gatewayResult.gatewayTxnId,
          gateway_payload: {
            ...gatewayResult,
            purpose: 'WALLET_TOPUP',
            partner_id: partnerId,
          } as any,
        },
      });

      return {
        payment_id: payment.id,
        payment_code: payment.payment_code,
        gateway_txn_id: gatewayResult.gatewayTxnId,
        payment_url: gatewayResult.paymentUrl,
      };
    } catch (gatewayError) {
      // If gateway fails, mark payment as failed
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
        },
      });

      logger.error('Payment gateway error', { error: gatewayError, paymentId: payment.id });
      throw new Error('GATEWAY_ERROR');
    }
  });
}

/**
 * Handle Payment Webhook
 */
export async function handlePaymentWebhook(
  gatewayTxnId: string,
  status: 'SUCCESS' | 'FAILED',
  amount: number,
  currency: string
) {
  return await prisma.$transaction(async (tx) => {
    // Find payment by gateway_txn_id
    const payment = await tx.payment.findFirst({
      where: { gateway_txn_id: gatewayTxnId },
      include: {
        order: {
          select: {
            id: true,
            partner_id: true,
            status: true,
            total_fee: true,
            wallet_used: true,
            payments: {
              where: {
                status: PaymentStatus.SUCCESS,
              },
              select: {
                amount: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      logger.warn('Payment webhook received for unknown payment', { gatewayTxnId });
      return { processed: false, reason: 'PAYMENT_NOT_FOUND' };
    }

    // Idempotency check: If already SUCCESS, return no-op
    if (payment.status === PaymentStatus.SUCCESS) {
      logger.info('Payment webhook duplicate ignored (already success)', {
        paymentId: payment.id,
        gatewayTxnId,
      });
      return { processed: false, reason: 'ALREADY_PROCESSED' };
    }

    if (status === 'SUCCESS') {
      // Verify amount matches
      if (payment.amount !== amount) {
        logger.error('Payment webhook amount mismatch', {
          paymentId: payment.id,
          expected: payment.amount,
          received: amount,
        });
        throw new Error('AMOUNT_MISMATCH');
      }

      // Check if this is wallet top-up (dummy order_id) or order payment
      const DUMMY_ORDER_ID = '00000000-0000-0000-0000-000000000000';
      const isTopup = payment.order_id === DUMMY_ORDER_ID;
      
      if (isTopup) {
        // Wallet top-up: Credit wallet
        // Extract partner_id from gateway_payload
        const gatewayPayload = payment.gateway_payload as any;
        const partnerId = gatewayPayload?.partner_id || gatewayPayload?.metadata?.partnerId;

        if (!partnerId) {
          logger.error('Cannot credit wallet: partner_id not found', { paymentId: payment.id });
          throw new Error('PARTNER_ID_MISSING');
        }

        // Credit wallet
        await creditWallet(
          partnerId,
          amount,
          currency,
          payment.method,
          gatewayTxnId,
          'Wallet top-up via payment gateway'
        );

        // Update payment status
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.SUCCESS,
          },
        });

        // Log activity
        await logActivity(partnerId, 'WALLET_CREDITED', `Wallet credited: ${amount} ${currency}`, {
          payment_id: payment.id,
          amount,
          gateway_txn_id: gatewayTxnId,
        });
      } else {
        // Order payment: Update payment status and check if order should move to IN_PROCESS
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.SUCCESS,
          },
        });

        // Check if order is fully paid
        if (payment.order) {
          // Get all successful payments for this order (including the one we just updated)
          const allPayments = await tx.payment.findMany({
            where: {
              order_id: payment.order.id,
              status: PaymentStatus.SUCCESS,
            },
            select: {
              amount: true,
            },
          });

          const totalPaid = (payment.order.wallet_used || 0) +
            allPayments.reduce((sum, p) => sum + p.amount, 0);

          if (totalPaid >= (payment.order.total_fee || 0) && payment.order.status === OrderStatus.READY_TO_PROCEED) {
            // Update order to IN_PROCESS
            await tx.order.update({
              where: { id: payment.order.id },
              data: {
                status: OrderStatus.IN_PROCESS,
              },
            });

            // Log activity
            await logActivity(
              payment.order.partner_id,
              'ORDER_PAYMENT_SUCCESS',
              'Order payment completed via gateway',
              {
                order_id: payment.order.id,
                payment_id: payment.id,
                amount,
              }
            );
          }
        }
      }
    } else {
      // FAILED: Just update payment status
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
        },
      });
    }

    return { processed: true };
  });
}

/**
 * Get Payment Status
 */
export async function getPaymentStatus(paymentId: string, partnerId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        select: {
          partner_id: true,
        },
      },
    },
  });

  if (!payment) {
    throw new Error('PAYMENT_NOT_FOUND');
  }

  // Verify ownership (via order or check if top-up payment)
  if (payment.order_id && payment.order?.partner_id !== partnerId) {
    throw new Error('PAYMENT_ACCESS_DENIED');
  }

  // For top-up payments, we can't verify ownership easily without partner_id in Payment
  // This is a schema limitation - in production, Payment should have partner_id

  return {
    id: payment.id,
    payment_code: payment.payment_code,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    order_id: payment.order_id || null,
    gateway_txn_id: payment.gateway_txn_id,
    created_at: payment.created_at,
    updated_at: payment.updated_at,
  };
}

/**
 * Pay Order (Wallet-first)
 */
export async function payOrder(orderId: string, partnerId: string, useWallet: boolean) {
  return await prisma.$transaction(async (tx) => {
    // Get order
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: {
            status: PaymentStatus.SUCCESS,
          },
          select: {
            amount: true,
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

    if (order.status !== OrderStatus.READY_TO_PROCEED) {
      throw new Error('ORDER_NOT_READY');
    }

    if (!order.total_fee) {
      throw new Error('ORDER_FEE_NOT_SET');
    }

    // Get wallet
    const wallet = await tx.wallet.findUnique({
      where: { partner_id: partnerId },
    });

    const walletBalance = wallet?.balance || 0;
    const walletUsed = order.wallet_used || 0;
    const totalPaid = walletUsed + order.payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = (order.total_fee || 0) - totalPaid;

    if (remaining <= 0) {
      // Already fully paid
      return {
        status: order.status,
        paid_via_wallet: walletUsed,
        remaining: 0,
      };
    }

    if (useWallet && walletBalance >= remaining) {
      // Full payment via wallet
      // Debit wallet (concurrency-safe)
      if (!wallet) {
        throw new Error('WALLET_NOT_FOUND');
      }

      // Check balance again in transaction
      if (wallet.balance < remaining) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      // Create wallet transaction
      const walletTxn = await tx.walletTransaction.create({
        data: {
          wallet_id: wallet.id,
          txn_type: WalletTxnType.DEBIT,
          method: PaymentMethod.WALLET,
          amount: remaining,
          currency: order.fee_currency || 'INR',
          order_id: orderId,
          reference_id: `ORDPAY-${order.order_code}`,
        },
      });

      // Update wallet balance
      await tx.wallet.update({
        where: {
          id: wallet.id,
          balance: {
            gte: remaining,
          },
        },
        data: {
          balance: {
            decrement: remaining,
          },
        },
      });

      // Update order
      await tx.order.update({
        where: { id: orderId },
        data: {
          wallet_used: (order.wallet_used || 0) + remaining,
          status: OrderStatus.IN_PROCESS,
        },
      });

      // Create payment record
      await tx.payment.create({
        data: {
          order_id: orderId,
          method: PaymentMethod.WALLET,
          amount: remaining,
          currency: order.fee_currency || 'INR',
          status: PaymentStatus.SUCCESS,
        },
      });

      // Log activity
      await logActivity(partnerId, 'ORDER_PAYMENT_SUCCESS', `Order paid via wallet: ${remaining}`, {
        order_id: orderId,
        amount: remaining,
        wallet_transaction_id: walletTxn.id,
      });

      return {
        status: OrderStatus.IN_PROCESS,
        paid_via_wallet: remaining,
        remaining: 0,
      };
    } else {
      // Insufficient wallet or not using wallet
      const walletPayment = Math.min(walletBalance, remaining);
      const gatewayRemaining = remaining - walletPayment;

      // If wallet has some balance, use it
      if (walletPayment > 0 && wallet) {
        // Debit partial wallet amount
        if (wallet.balance >= walletPayment) {
          const walletTxn = await tx.walletTransaction.create({
            data: {
              wallet_id: wallet.id,
              txn_type: WalletTxnType.DEBIT,
              method: PaymentMethod.WALLET,
              amount: walletPayment,
              currency: order.fee_currency || 'INR',
              order_id: orderId,
              reference_id: `ORDPAY-${order.order_code}-PARTIAL`,
            },
          });

          await tx.wallet.update({
            where: {
              id: wallet.id,
              balance: {
                gte: walletPayment,
              },
            },
            data: {
              balance: {
                decrement: walletPayment,
              },
            },
          });

          await tx.order.update({
            where: { id: orderId },
            data: {
              wallet_used: (order.wallet_used || 0) + walletPayment,
            },
          });

          await tx.payment.create({
            data: {
              order_id: orderId,
              method: PaymentMethod.WALLET,
              amount: walletPayment,
              currency: order.fee_currency || 'INR',
              status: PaymentStatus.SUCCESS,
            },
          });
        }
      }

      // Create gateway payment for remaining
      if (gatewayRemaining > 0) {
        const payment = await tx.payment.create({
          data: {
            order_id: orderId,
            method: PaymentMethod.UPI, // Default, can be configurable
            amount: gatewayRemaining,
            currency: order.fee_currency || 'INR',
            status: PaymentStatus.INITIATED,
          },
        });

        // Call payment gateway
        try {
          const gatewayResult = await paymentGateway.createPayment({
            amount: gatewayRemaining,
            currency: order.fee_currency || 'INR',
            partnerId: partnerId,
            purpose: 'ORDER_PAYMENT',
            referenceId: payment.payment_code,
            metadata: {
              payment_id: payment.id,
              order_id: orderId,
              partner_id: partnerId,
            },
          });

          await tx.payment.update({
            where: { id: payment.id },
            data: {
              gateway_txn_id: gatewayResult.gatewayTxnId,
              gateway_payload: gatewayResult as any,
            },
          });

          return {
            status: OrderStatus.READY_TO_PROCEED,
            paid_via_wallet: walletPayment,
            remaining: gatewayRemaining,
            payment: {
              payment_id: payment.id,
              payment_code: payment.payment_code,
              gateway_txn_id: gatewayResult.gatewayTxnId,
              payment_url: gatewayResult.paymentUrl,
            },
          };
        } catch (gatewayError) {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.FAILED,
            },
          });
          throw new Error('GATEWAY_ERROR');
        }
      }

      return {
        status: OrderStatus.READY_TO_PROCEED,
        paid_via_wallet: walletPayment,
        remaining: gatewayRemaining,
      };
    }
  });
}
