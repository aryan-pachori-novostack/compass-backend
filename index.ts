import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './src/config/env.js';
import logger from './src/utils/logger.js';
import { logger_middleware } from './src/middlewares/logger_middleware.js';
import { error_handler } from './src/middlewares/error_handler.js';
import { api_rate_limiter } from './src/middlewares/rate_limiter.js';
import { close_redis_connections } from './src/config/redis.js';

// Import routers
import authRouter from './src/modules/auth/auth.routes.js';
import partnerRouter from './src/modules/partner/partner.routes.js';
import opsPartnerRouter from './src/modules/ops/partner.routes.js';
import catalogRouter from './src/modules/catalog/catalog.routes.js';
import ordersRouter from './src/modules/orders/orders.routes.js';
import applicationsRouter from './src/modules/applications/applications.routes.js';
import documentsRouter from './src/modules/documents/documents.routes.js';
import webhooksRouter from './src/modules/webhooks/webhooks.routes.js';
import walletRouter from './src/modules/wallet/wallet.routes.js';
import paymentsRouter from './src/modules/payments/payments.routes.js';
import opsRouter from './src/modules/ops/ops.routes.js';
import supportRouter from './src/modules/support/support.routes.js';
import activityRouter from './src/modules/activity/activity.routes.js';

const app: Express = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/auth', authRouter);
app.use('/partner', partnerRouter);
app.use('/ops', opsPartnerRouter);
app.use('/catalog', catalogRouter);
app.use('/orders', ordersRouter);
app.use('/', applicationsRouter);
app.use('/', documentsRouter);
app.use('/webhooks', webhooksRouter);
app.use('/wallet', walletRouter);
app.use('/', paymentsRouter);
app.use('/ops', opsRouter);
app.use('/support', supportRouter);
app.use('/activity', activityRouter);

// Error handler middleware (must be last)
app.use(error_handler);

// Start server
const port = env.port;

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await close_redis_connections();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await close_redis_connections();
  process.exit(0);
});

app.listen(port, () => {
  logger.info(`🚀 Server running on port ${port} in ${env.node_env} mode`);
});

export default app;
