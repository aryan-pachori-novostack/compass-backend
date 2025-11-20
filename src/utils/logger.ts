import winston from 'winston';
import { env } from '../config/env.js';

const logger = winston.createLogger({
  level: env.logger.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: env.logger.service_name },
  transports: [
    new winston.transports.File({ filename: env.logger.error_log_file, level: 'error' }),
    new winston.transports.File({ filename: env.logger.combined_log_file }),
  ],
});

if (env.logger.enable_console) {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

export default logger;

