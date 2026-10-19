import http from 'http';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { app } from './app.js';

let server: http.Server | null = null;
let isShuttingDown = false;

/**
 * Graceful process shutdown handler.
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.info(`[Server] Received ${signal}. Initiating graceful shutdown...`);

  // Force shutdown timeout if graceful shutdown takes too long
  const forceExitTimeout = setTimeout(() => {
    console.error('[Server Error] Graceful shutdown timed out. Forcing process termination.');
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.info('[Server] HTTP listener closed.');
            resolve();
          }
        });
      });
    }

    await disconnectDatabase();
    console.info('[Server] Graceful shutdown completed.');
    process.exit(0);
  } catch (err) {
    console.error('[Server Error] Error during graceful shutdown:', err);
    process.exit(1);
  }
}

/**
 * Main application bootstrap function.
 */
async function startServer(): Promise<void> {
  try {
    console.info(`[Server] Initializing DevLaunch Backend (${env.NODE_ENV})...`);

    // Step 1: Connect to MongoDB (fail-fast)
    await connectDatabase();

    // Step 2: Start HTTP server
    server = app.listen(env.PORT, () => {
      console.info(`[Server] HTTP server listening on port ${env.PORT}`);
      console.info(`[Server] Allowed CORS origin: ${env.CLIENT_URL}`);
      console.info(`[Server] Health check endpoint: http://localhost:${env.PORT}/api/health`);
    });

    server.on('error', async (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(
          `[Server Error] Port ${env.PORT} is already in use. Please specify an alternate PORT in .env or stop the conflicting service.`
        );
      } else {
        console.error('[Server Error] HTTP server encountered an error:', err);
      }
      await disconnectDatabase();
      process.exit(1);
    });

    // Step 3: Register process shutdown hooks
    process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  } catch (err) {
    console.error('[Server Error] Startup failed. Halting process execution.');
    process.exit(1);
  }
}

void startServer();
