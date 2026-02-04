import { env } from '../../config/env.js';
import logger from '../../utils/logger.js';

/**
 * OCR Provider Interface
 */
export interface OcrProvider {
  submit(params: { documentId: string; fileUrl: string; docName: string }): Promise<{ jobId: string }>;
  verifyWebhook(req: any): boolean;
}

/**
 * OCR Provider Implementation (Stub/Mock)
 * In production, this would integrate with actual OCR service
 */
class MockOcrProvider implements OcrProvider {
  async submit(params: { documentId: string; fileUrl: string; docName: string }): Promise<{ jobId: string }> {
    // Mock implementation - in production, call actual OCR service
    const jobId = `ocr_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    logger.info('OCR job submitted (mock)', {
      documentId: params.documentId,
      jobId,
      docName: params.docName,
    });

    // In production, this would make HTTP request to OCR service
    // For now, return mock job ID
    return { jobId };
  }

  verifyWebhook(req: any): boolean {
    // Mock implementation - in production, verify signature from OCR provider
    // For now, check for API key in headers or body
    const apiKey = req.headers['x-ocr-api-key'] || req.body?.api_key;
    
    if (env.ocr.api_key && apiKey === env.ocr.api_key) {
      return true;
    }

    // In development, allow if no API key configured
    if (!env.ocr.api_key && process.env.NODE_ENV === 'development') {
      logger.warn('OCR webhook verification skipped in development mode');
      return true;
    }

    logger.warn('OCR webhook verification failed', {
      hasApiKey: !!env.ocr.api_key,
      receivedKey: !!apiKey,
    });

    return false;
  }
}

// Export singleton instance
export const ocrProvider: OcrProvider = new MockOcrProvider();

/**
 * Upload file to storage (abstraction)
 * In production, this would use S3 or similar
 */
export async function uploadFileToStorage(
  file: Express.Multer.File,
  path: string
): Promise<string> {
  // For now, use local storage path
  // In production, integrate with S3 utility
  const fs = await import('fs');
  const pathModule = await import('path');
  
  const uploadDir = pathModule.join(process.cwd(), 'uploads', path);
  const uploadDirParent = pathModule.dirname(uploadDir);
  
  if (!fs.existsSync(uploadDirParent)) {
    fs.mkdirSync(uploadDirParent, { recursive: true });
  }

  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${pathModule.extname(file.originalname)}`;
  const filePath = pathModule.join(uploadDir, fileName);
  
  fs.writeFileSync(filePath, file.buffer);
  
  // Return relative path or S3 URL in production
  // For now, return relative path
  return `uploads/${path}/${fileName}`;
}
