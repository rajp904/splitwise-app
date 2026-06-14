// Global error handler middleware.
// Catches any error thrown in route handlers and returns a consistent JSON response.
// Must be registered LAST in the Express app (after all routes).

import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Prisma unique constraint violation
  if (err.message.includes('Unique constraint')) {
    res.status(409).json({ error: 'A record with this data already exists' });
    return;
  }

  // Generic fallback — hide internals in production
  res.status(500).json({
    error: 'Internal server error',
    ...(env.nodeEnv === 'development' && { detail: err.message }),
  });
}
