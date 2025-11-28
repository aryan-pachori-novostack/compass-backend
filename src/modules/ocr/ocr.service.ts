import { env } from '../../config/env.js';
import logger from '../../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface SubmitOCRRequest {
  order_id: string;
  traveller_id: string;
  document_id: string;
  file_path: string;
}

export interface OCRSubmissionResponse {
  job_id: string;
  status: 'submitted' | 'error';
  message?: string;
}

class OCRService {
  private readonly ocr_service_url: string;
  private readonly ocr_api_key: string | undefined;

  constructor() {
    this.ocr_service_url = env.ocr.service_url;
    this.ocr_api_key = env.ocr.api_key;
  }

  /**
   * Submit a passport document to OCR service for processing
   */
  async submit_passport_for_ocr(request: SubmitOCRRequest): Promise<OCRSubmissionResponse> {
    const { order_id, traveller_id, document_id, file_path } = request;

    // Validate file exists
    if (!fs.existsSync(file_path)) {
      throw new Error(`File not found: ${file_path}`);
    }

    try {
      // Read file as buffer
      const file_buffer = fs.readFileSync(file_path);
      const filename = path.basename(file_path);

      // Create FormData using built-in FormData (Node.js 18+)
      const form_data = new FormData();
      const file_blob = new Blob([file_buffer]);
      form_data.append('file', file_blob, filename);

      // Add query parameters
      const url = new URL(`${this.ocr_service_url}/api/v1/passport/extract`);
      url.searchParams.append('order_id', order_id);
      url.searchParams.append('traveller_id', traveller_id);
      url.searchParams.append('document_id', document_id);

      // Make HTTP request
      const response = await fetch(url.toString(), {
        method: 'POST',
        body: form_data,
      });

      if (!response.ok) {
        const error_text = await response.text();
        throw new Error(`OCR service error: ${response.status} - ${error_text}`);
      }

      const result = await response.json();

      if (result.status === 'processing' && result.job_id) {
        logger.info(`OCR job submitted: ${result.job_id} for document ${document_id}`);
        return {
          job_id: result.job_id,
          status: 'submitted',
          message: result.message,
        };
      } else {
        throw new Error(`Unexpected response from OCR service: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      logger.error(`Failed to submit OCR job for document ${document_id}:`, error);
      throw error;
    }
  }

  /**
   * Check if OCR service is healthy
   */
  async health_check(): Promise<boolean> {
    try {
      const response = await fetch(`${this.ocr_service_url}/api/v1/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      logger.error('OCR service health check failed:', error);
      return false;
    }
  }
}

export default new OCRService();

