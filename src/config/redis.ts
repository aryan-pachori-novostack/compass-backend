import Redis from 'ioredis';
import { env } from './env.js';
import logger from '../utils/logger.js';

let redis_client: Redis | null = null;
let redis_subscriber: Redis | null = null;

/**
 * Get or create Redis client
 */
export function get_redis_client(): Redis {
  if (!redis_client) {
    try {
      redis_client = new Redis(env.redis.url, {
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      redis_client.on('connect', () => {
        logger.info('✓ Connected to Redis');
      });

      redis_client.on('error', (error: Error) => {
        logger.error('Redis client error:', error);
      });

      redis_client.on('close', () => {
        logger.warn('Redis connection closed');
      });
    } catch (error) {
      logger.error('Failed to create Redis client:', error);
      throw error;
    }
  }
  return redis_client;
}

/**
 * Get or create Redis subscriber client
 * (Separate connection for pub/sub)
 */
export function get_redis_subscriber(): Redis {
  if (!redis_subscriber) {
    try {
      redis_subscriber = new Redis(env.redis.url, {
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      redis_subscriber.on('connect', () => {
        logger.info('✓ Connected to Redis subscriber');
      });

      redis_subscriber.on('error', (error: Error) => {
        logger.error('Redis subscriber error:', error);
      });

      redis_subscriber.on('close', () => {
        logger.warn('Redis subscriber connection closed');
      });
    } catch (error) {
      logger.error('Failed to create Redis subscriber:', error);
      throw error;
    }
  }
  return redis_subscriber;
}

/**
 * Close Redis connections gracefully
 */
export async function close_redis_connections(): Promise<void> {
  try {
    if (redis_client) {
      await redis_client.quit();
      redis_client = null;
      logger.info('Redis client closed');
    }
    if (redis_subscriber) {
      await redis_subscriber.quit();
      redis_subscriber = null;
      logger.info('Redis subscriber closed');
    }
  } catch (error) {
    logger.error('Error closing Redis connections:', error);
  }
}

export default {
  get_redis_client,
  get_redis_subscriber,
  close_redis_connections,
};

