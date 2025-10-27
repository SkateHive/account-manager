import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import pino from 'pino';
import { config } from './config/env';
import { globalRateLimiter } from './middleware/rate';
import healthRouter from './routes/health';
import accountsRouter from './routes/accounts';

/**
 * Create Express application instance
 */
const app = express();

/**
 * Configure Pino logger for structured JSON logging
 * Includes request IDs for tracing
 */
const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: config.NODE_ENV === 'development' 
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  // Redact sensitive fields from logs
  redact: {
    paths: [
      'req.headers.x-signer-token',
      'req.headers.authorization',
      'HIVE_CREATOR_ACTIVE_WIF',
      'SIGNER_TOKEN',
    ],
    remove: true,
  },
});

/**
 * HTTP request logger with automatic request ID generation
 */
const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
  },
});

/**
 * Security middleware - Helmet
 * Sets various HTTP headers for security
 */
app.use(helmet());

/**
 * Request logging middleware
 */
app.use(httpLogger);

/**
 * Body parsing middleware
 * Limit payload size to prevent abuse
 */
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/**
 * CORS is disabled by default for security
 * Enable only if needed and configure appropriately
 */
// app.use(cors({ origin: 'https://your-frontend-domain.com' }));

/**
 * Global rate limiting middleware
 */
app.use(globalRateLimiter);

/**
 * Mount route handlers
 */
app.use('/', healthRouter);
app.use('/', accountsRouter);

/**
 * 404 handler for undefined routes
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

/**
 * Global error handler
 * Catches all unhandled errors and returns consistent JSON response
 */
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  // Log error details
  req.log.error({ err }, 'Unhandled error');
  
  // Send error response
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
  });
});

/**
 * Start the server
 */
const server = app.listen(config.PORT, () => {
  logger.info(
    {
      port: config.PORT,
      nodeEnv: config.NODE_ENV,
      hiveNode: config.HIVE_NODE_URL,
      creator: config.HIVE_CREATOR,
    },
    'Skatehive Hive Signer microservice started'
  );
});

/**
 * Graceful shutdown handlers
 * Ensures active connections are closed properly
 */
const gracefulShutdown = (signal: string): void => {
  logger.info({ signal }, 'Received shutdown signal, closing server...');
  
  server.close(() => {
    logger.info('Server closed successfully');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Promise Rejection');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught Exception');
  gracefulShutdown('uncaughtException');
});

export default app;
