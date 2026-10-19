import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { apiRouter } from './routes/index.js';
import { validateOrigin } from './middleware/validateOrigin.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';

/**
 * Creates and configures the Express application instance.
 * Does not bind network ports or connect to the database.
 */
export function createApp(): Express {
  const app = express();

  // Middleware: Request logging
  app.use(requestLogger);

  // Middleware: Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Middleware: JSON body parsing
  app.use(express.json());

  // Middleware: Cookie parsing
  app.use(cookieParser());

  // Middleware: CSRF defense-in-depth origin validation
  app.use(validateOrigin);

  // Mount API Routes
  app.use('/api', apiRouter);

  // Middleware: 404 Not Found handler
  app.use(notFoundHandler);

  // Middleware: Centralized Error handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
