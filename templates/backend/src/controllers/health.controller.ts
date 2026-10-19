import { Request, Response } from 'express';
import { isDatabaseConnected, getDatabaseStatus } from '../config/database.js';
import { env } from '../config/env.js';

export function getHealth(_req: Request, res: Response): void {
  const connected = isDatabaseConnected();
  const dbStatus = getDatabaseStatus();

  const statusCode = connected ? 200 : 503;
  const healthStatus = connected ? 'ok' : 'degraded';

  res.status(statusCode).json({
    status: healthStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
    database: {
      status: dbStatus,
    },
  });
}
