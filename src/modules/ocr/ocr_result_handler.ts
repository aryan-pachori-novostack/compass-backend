import { get_redis_subscriber } from '../../config/redis.js';
import { env } from '../../config/env.js';
import prisma from '../../config/prisma.js';
import logger from '../../utils/logger.js';

interface OCRResultMessage {
  job_id: string;
  order_id: string;
  traveller_id: string;
  document_id: string;
  result: {
    status: 'success' | 'error';
    data?: {
      passport_number?: string;
      full_name?: string;
      given_names?: string;
      surname?: string;
      nationality?: string;
      issuing_country?: string;
      date_of_birth?: string;
      date_of_expiry?: string;
      sex?: string;
      document_type?: string;
      personal_number?: string;
      is_valid?: boolean;
      mrz_checksum_valid?: boolean;
    };
    validation?: {
      is_valid?: boolean;
      errors?: string[];
    };
    error?: string;
    raw_result?: any;
  };
  timestamp?: string;
}

class OCRResultHandler {
  private subscriber: ReturnType<typeof get_redis_subscriber> | null = null;
  private is_subscribed: boolean = false;

  /**
   * Start listening for OCR results from Redis
   */
  async start(): Promise<void> {
    if (this.is_subscribed) {
      logger.warn('OCR result handler already started');
      return;
    }

    try {
      this.subscriber = get_redis_subscriber();
      const channel = env.redis.ocr_result_channel;

      await this.subscriber.subscribe(channel);
      logger.info(`✓ Subscribed to OCR results channel: ${channel}`);

      this.subscriber.on('message', async (channel_name, message) => {
        if (channel_name === channel) {
          await this.handle_ocr_result(message);
        }
      });

      this.is_subscribed = true;
    } catch (error) {
      logger.error('Failed to start OCR result handler:', error);
      throw error;
    }
  }

  /**
   * Stop listening for OCR results
   */
  async stop(): Promise<void> {
    if (!this.is_subscribed || !this.subscriber) {
      return;
    }

    try {
      const channel = env.redis.ocr_result_channel;
      await this.subscriber.unsubscribe(channel);
      this.is_subscribed = false;
      logger.info('OCR result handler stopped');
    } catch (error) {
      logger.error('Error stopping OCR result handler:', error);
    }
  }

  /**
   * Handle incoming OCR result message
   */
  private async handle_ocr_result(message: string): Promise<void> {
    try {
      const data: OCRResultMessage = JSON.parse(message);
      const { job_id, order_id, traveller_id, document_id, result } = data;

      logger.info(`Processing OCR result for job ${job_id}, document ${document_id}`);

      // Find document by order_traveller_document_id
      const document = await prisma.orderTravellerDocument.findFirst({
        where: { order_traveller_document_id: document_id },
      });

      if (!document) {
        logger.error(`Document not found with order_traveller_document_id: ${document_id}`);
        return;
      }

      // Update document OCR status and data
      await prisma.orderTravellerDocument.update({
        where: { id: document.id },
        data: {
          ocr_status: result.status === 'success' ? 'COMPLETED' : 'FAILED',
          ocr_extracted_data: result.raw_result || result,
        },
      });

      // If successful, update traveller information
      if (result.status === 'success' && result.data) {
        // Find traveller by order_traveller_id
        const traveller = await prisma.orderTraveller.findFirst({
          where: { order_traveller_id: traveller_id },
        });

        if (traveller) {
          await this.update_traveller_from_ocr(traveller.id, result.data);
        } else {
          logger.error(`Traveller not found with order_traveller_id: ${traveller_id}`);
        }
      }

      logger.info(`✓ OCR result processed for job ${job_id}`);
    } catch (error) {
      logger.error('Error handling OCR result:', error);
      // Try to update document status to FAILED if we can identify it
      try {
        const data: OCRResultMessage = JSON.parse(message);
        if (data.document_id) {
          const document = await prisma.orderTravellerDocument.findFirst({
            where: { order_traveller_document_id: data.document_id },
          });
          if (document) {
            await prisma.orderTravellerDocument.update({
              where: { id: document.id },
              data: {
                ocr_status: 'FAILED',
              },
            });
          }
        }
      } catch (update_error) {
        logger.error('Failed to update document status after error:', update_error);
      }
    }
  }

  /**
   * Update traveller information from OCR results
   */
  private async update_traveller_from_ocr(
    traveller_id: string,
    ocr_data: OCRResultMessage['result']['data']
  ): Promise<void> {
    try {
      const update_data: any = {};

      // Map OCR fields to traveller fields
      if (ocr_data.passport_number) {
        update_data.passport_number = ocr_data.passport_number;
      }

      if (ocr_data.date_of_expiry) {
        try {
          update_data.passport_expiry_date = new Date(ocr_data.date_of_expiry);
        } catch (error) {
          logger.warn(`Invalid expiry date format: ${ocr_data.date_of_expiry}`);
        }
      }

      if (ocr_data.date_of_birth) {
        try {
          update_data.date_of_birth = new Date(ocr_data.date_of_birth);
        } catch (error) {
          logger.warn(`Invalid birth date format: ${ocr_data.date_of_birth}`);
        }
      }

      // Update full name if available
      if (ocr_data.full_name) {
        update_data.full_name = ocr_data.full_name;
      } else if (ocr_data.given_names || ocr_data.surname) {
        const full_name = `${ocr_data.given_names || ''} ${ocr_data.surname || ''}`.trim();
        if (full_name) {
          update_data.full_name = full_name;
        }
      }

      // Map nationality to country_id if possible
      if (ocr_data.nationality) {
        try {
          const country = await prisma.country.findFirst({
            where: {
              iso_code: ocr_data.nationality,
            },
          });
          if (country) {
            update_data.nationality_id = country.id;
          } else {
            logger.warn(`Country not found for ISO code: ${ocr_data.nationality}`);
          }
        } catch (error) {
          logger.warn(`Error mapping nationality: ${ocr_data.nationality}`, error);
        }
      }

      // Only update if we have data to update
      if (Object.keys(update_data).length > 0) {
        await prisma.orderTraveller.update({
          where: { id: traveller_id },
          data: update_data,
        });
        logger.info(`✓ Updated traveller ${traveller_id} from OCR data`);
      }
    } catch (error) {
      logger.error(`Error updating traveller ${traveller_id} from OCR:`, error);
      throw error;
    }
  }
}

export default new OCRResultHandler();

