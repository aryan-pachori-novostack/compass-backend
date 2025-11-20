import { type Request, type Response, type NextFunction } from 'express';
import logger from '../utils/logger.js';
import { env } from '../config/env.js';

// Helper function to sanitize sensitive data
const sanitize_data = (data: any, sensitive_fields: string[]): any => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitize_data(item, sensitive_fields));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    const lower_key = key.toLowerCase();
    const is_sensitive = sensitive_fields.some(field => lower_key.includes(field.toLowerCase()));
    
    if (is_sensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize_data(value, sensitive_fields);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// Helper function to sanitize headers
const sanitize_headers = (headers: any, sensitive_fields: string[]): any => {
  if (!headers) return headers;
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower_key = key.toLowerCase();
    const is_sensitive = sensitive_fields.some(field => lower_key.includes(field.toLowerCase()));
    
    if (is_sensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

export const logger_middleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start_time = Date.now();
  const request_id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

  // Build request log data
  const request_log: any = {
    request_id,
    method: req.method,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress,
    user_agent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
  };

  // Add query parameters if enabled
  if (env.logger.log_query_params && Object.keys(req.query).length > 0) {
    request_log.query_params = sanitize_data(req.query, env.logger.sensitive_fields);
  }

  // Add request headers if enabled
  if (env.logger.log_request_headers) {
    request_log.headers = sanitize_headers(req.headers, env.logger.sensitive_fields);
  }

  // Add request body if enabled (and not empty)
  if (env.logger.log_request_body && req.body && Object.keys(req.body).length > 0) {
    request_log.body = sanitize_data(req.body, env.logger.sensitive_fields);
  }

  // Add authentication info if available
  if ((req as any).partner_account_id) {
    request_log.authenticated_user = {
      partner_account_id: (req as any).partner_account_id,
      email: (req as any).email,
      partner_type: (req as any).partner_type,
    };
  }

  // Log request
  logger.info('Incoming request', request_log);

  // Capture original response methods
  const original_send = res.send;
  const original_json = res.json;
  let response_body: any = null;

  // Override res.json to capture response body
  res.json = function (body: any) {
    if (env.logger.log_response_body) {
      response_body = body;
    }
    return original_json.call(this, body);
  };

  // Override res.send to capture response body
  res.send = function (body: any) {
    if (env.logger.log_response_body && typeof body === 'string') {
      try {
        response_body = JSON.parse(body);
      } catch {
        response_body = body;
      }
    }
    return original_send.call(this, body);
  };

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - start_time;
    
    // Build response log data
    const response_log: any = {
      request_id,
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    };

    // Add response headers if enabled
    if (env.logger.log_response_headers) {
      response_log.headers = sanitize_headers(res.getHeaders(), env.logger.sensitive_fields);
    }

    // Add response body if enabled
    if (env.logger.log_response_body && response_body) {
      response_log.body = sanitize_data(response_body, env.logger.sensitive_fields);
    }

    // Log level based on status code
    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', response_log);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', response_log);
    } else {
      logger.info('Request completed successfully', response_log);
    }
  });

  next();
};

export default logger_middleware;

