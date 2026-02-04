import { PrismaClient } from '@prisma/client';
import prisma from '../../config/prisma.js';

/**
 * Get Partner Activity Feed
 */
export async function getPartnerActivityFeed(
  partnerId: string,
  page: number = 1,
  limit: number = 20
) {
  const [logs, total] = await Promise.all([
    prisma.partnerActivityLog.findMany({
      where: {
        partner_id: partnerId,
      },
      select: {
        id: true,
        event_type: true,
        message: true,
        payload: true,
        created_at: true,
      },
      orderBy: {
        created_at: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.partnerActivityLog.count({
      where: {
        partner_id: partnerId,
      },
    }),
  ]);

  return {
    items: logs.map((log) => ({
      id: log.id,
      event_type: log.event_type,
      message: log.message,
      payload: log.payload,
      created_at: log.created_at,
    })),
    page,
    limit,
    total,
  };
}
