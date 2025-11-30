import dotenv from 'dotenv';

dotenv.config();

const database_url = process.env.DATABASE_URL;
const jwt_secret = process.env.JWT_SECRET;

// Validate required environment variables
if (!database_url) {
  throw new Error('DATABASE_URL is required in environment variables');
}

if (!jwt_secret) {
  throw new Error('JWT_SECRET is required in environment variables');
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  node_env: (process.env.NODE_ENV || 'development') as string,
  database_url: database_url,
  jwt_secret: jwt_secret,
  jwt_expires_in: (process.env.JWT_EXPIRES_IN || '7d') as string,
  
  // Rate limiting configuration
  rate_limit: {
    api_window_ms: Number(process.env.RATE_LIMIT_API_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    api_max_requests: Number(process.env.RATE_LIMIT_API_MAX) || 100,
    auth_window_ms: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    auth_max_requests: Number(process.env.RATE_LIMIT_AUTH_MAX) || 5,
    auth_skip_successful: process.env.RATE_LIMIT_AUTH_SKIP_SUCCESSFUL === 'true' || true,
  },
  
  // Logger configuration
  logger: {
    level: process.env.LOGGER_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    error_log_file: process.env.LOGGER_ERROR_FILE || 'logs/error.log',
    combined_log_file: process.env.LOGGER_COMBINED_FILE || 'logs/combined.log',
    enable_console: process.env.LOGGER_ENABLE_CONSOLE !== 'false', // Default true
    service_name: process.env.LOGGER_SERVICE_NAME || 'compass-backend',
    // Request/Response logging options
    log_request_body: process.env.LOGGER_LOG_REQUEST_BODY === 'true', // Default false (security)
    log_response_body: process.env.LOGGER_LOG_RESPONSE_BODY === 'true', // Default false (performance)
    log_request_headers: process.env.LOGGER_LOG_REQUEST_HEADERS === 'true', // Default false (security)
    log_response_headers: process.env.LOGGER_LOG_RESPONSE_HEADERS === 'false', // Default false
    log_query_params: process.env.LOGGER_LOG_QUERY_PARAMS !== 'false', // Default true
    sensitive_fields: (process.env.LOGGER_SENSITIVE_FIELDS || 'password,authorization,token').split(',').map(s => s.trim()),
  },
  
  // OCR Service configuration
  ocr: {
    service_url: process.env.OCR_MICROSERVICE_URL || 'http://localhost:8001',
    api_key: process.env.OCR_SERVICE_API_KEY || undefined,
  },
  
  // Redis configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ocr_result_channel: process.env.OCR_RESULT_CHANNEL || 'ocr_results',
    ocr_progress_channel: process.env.OCR_PROGRESS_CHANNEL || 'ocr_progress',
  },
  
  // S3 configuration
  s3: {
    access_key_id: process.env.AWS_ACCESS_KEY_ID || '',
    secret_access_key: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    bucket_name: process.env.S3_BUCKET_NAME || '',
  },
};

export default env;

