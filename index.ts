import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './src/config/env.js';
import logger from './src/utils/logger.js';
import { logger_middleware } from './src/middlewares/logger_middleware.js';
import { error_handler } from './src/middlewares/error_handler.js';
import { api_rate_limiter, auth_rate_limiter } from './src/middlewares/rate_limiter.js';

// Import routers
import auth_router from './src/api/auth/auth.router.js';
import country_router from './src/api/country/country.router.js';
import visa_router from './src/api/visa/visa.router.js';
import order_router from './src/api/order/order.router.js';
import ocr_router from './src/api/ocr/ocr.router.js';

// Import OCR result handler
import ocr_result_handler from './src/modules/ocr/ocr_result_handler.js';
import { close_redis_connections } from './src/config/redis.js';

const app: Express = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Logging middleware
app.use(logger_middleware);

// Rate limiting
app.use(api_rate_limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/auth', auth_rate_limiter, auth_router);
app.use('/country', country_router);
app.use('/visa', visa_router);
app.use('/order', order_router);
app.use('/ocr', ocr_router);

// Error handler middleware (must be last)
app.use(error_handler);

// Start server
const port = env.port;

// Start OCR result handler
ocr_result_handler.start().catch((error) => {
  logger.error('Failed to start OCR result handler:', error);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await ocr_result_handler.stop();
  await close_redis_connections();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await ocr_result_handler.stop();
  await close_redis_connections();
  process.exit(0);
});

app.listen(port, () => {
  logger.info(`🚀 Server running on port ${port} in ${env.node_env} mode`);
});

export default app;

