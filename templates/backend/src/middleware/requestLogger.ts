import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { method, originalUrl } = req;
    const { statusCode } = res;

    // Log only method, sanitized path, status code, and duration
    console.info(`[HTTP] ${method} ${originalUrl} ${statusCode} - ${duration}ms`);
  });

  next();
}
