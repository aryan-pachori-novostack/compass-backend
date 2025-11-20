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
app.use('/auth', auth_rate_limiter, auth_router);
app.use('/country', country_router);
app.use('/visa', visa_router);

// Error handler middleware (must be last)
app.use(error_handler);

// Start server
const port = env.port;

app.listen(port, () => {
  logger.info(`🚀 Server running on port ${port} in ${env.node_env} mode`);
});

export default app;

