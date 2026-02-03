import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './src/config/env.js';
import logger from './src/utils/logger.js';
import { logger_middleware } from './src/middlewares/logger_middleware.js';
import { error_handler } from './src/middlewares/error_handler.js';
import { api_rate_limiter } from './src/middlewares/rate_limiter.js';
import { close_redis_connections } from './src/config/redis.js';

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
