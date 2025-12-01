import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import logger from './logger.js';
import * as fs from 'fs';

let s3_client: S3Client | null = null;

/**
 * Get or create S3 client
 */
function get_s3_client(): S3Client {
  if (!s3_client) {
    // Only create client if credentials are provided and non-empty
    const has_access_key = env.s3.access_key_id && env.s3.access_key_id.trim().length > 0;
    const has_secret_key = env.s3.secret_access_key && env.s3.secret_access_key.trim().length > 0;
    
    if (!has_access_key || !has_secret_key) {
      throw new Error('S3 credentials not configured');
    }
    s3_client = new S3Client({
      region: env.s3.region,
      credentials: {
        accessKeyId: env.s3.access_key_id,
        secretAccessKey: env.s3.secret_access_key,
      },
    });
  }
  return s3_client;
}

export interface UploadToS3Options {
  file_path: string;
  s3_key: string;
  content_type?: string;
  metadata?: Record<string, string>;
}

export interface UploadToS3Result {
  s3_key: string;
  s3_url: string;
}

/**
 * Upload file to S3
 */
export async function upload_to_s3(options: UploadToS3Options): Promise<UploadToS3Result> {
  const { file_path, s3_key, content_type, metadata } = options;

  if (!fs.existsSync(file_path)) {
    throw new Error(`File not found: ${file_path}`);
  }

  try {
    const client = get_s3_client();
    const file_buffer = fs.readFileSync(file_path);

    const command = new PutObjectCommand({
      Bucket: env.s3.bucket_name,
      Key: s3_key,
      Body: file_buffer,
      ContentType: content_type || 'application/octet-stream',
      Metadata: metadata,
    });

    await client.send(command);

    const s3_url = `s3://${env.s3.bucket_name}/${s3_key}`;

    logger.info(`File uploaded to S3: ${s3_url}`);

    return {
      s3_key,
      s3_url,
    };
  } catch (error) {
    logger.error(`Failed to upload file to S3: ${file_path}`, error);
    throw error;
  }
}

/**
 * Get pre-signed URL for viewing/downloading file from S3
 */
export async function get_signed_url(s3_key: string, expires_in: number = 3600): Promise<string> {
  try {
    const client = get_s3_client();

    const command = new GetObjectCommand({
      Bucket: env.s3.bucket_name,
      Key: s3_key,
    });

    const signed_url = await getSignedUrl(client, command, { expiresIn: expires_in });

    return signed_url;
  } catch (error) {
    logger.error(`Failed to generate signed URL for S3 key: ${s3_key}`, error);
    throw error;
  }
}

/**
 * Delete file from S3
 */
export async function delete_from_s3(s3_key: string): Promise<void> {
  try {
    const client = get_s3_client();

    const command = new DeleteObjectCommand({
      Bucket: env.s3.bucket_name,
      Key: s3_key,
    });

    await client.send(command);

    logger.info(`File deleted from S3: ${s3_key}`);
  } catch (error) {
    logger.error(`Failed to delete file from S3: ${s3_key}`, error);
    throw error;
  }
}

/**
 * Extract S3 key from S3 URL
 */
export function extract_s3_key_from_url(s3_url: string): string {
  // Handle s3://bucket/key format
  if (s3_url.startsWith('s3://')) {
    const parts = s3_url.replace('s3://', '').split('/');
    return parts.slice(1).join('/');
  }

  // Handle https://bucket.s3.region.amazonaws.com/key format
  if (s3_url.startsWith('https://')) {
    const url = new URL(s3_url);
    return url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
  }

  // Assume it's already a key
  return s3_url;
}

export default {
  upload_to_s3,
  get_signed_url,
  delete_from_s3,
  extract_s3_key_from_url,
};

