import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Safe console error reporting - never print raw request bodies or auth secrets!
  console.error('[API Error]', {
    method: req.method,
    path: req.path,
    message: err?.message || 'Unknown error',
  });

  // Handle Zod validation errors cleanly
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Handle duplicate key error from MongoDB (e.g. unique username or email)
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    res.status(409).json({
      error: `An account with this ${field} already exists.`,
      code: 'DUPLICATE_KEY',
    });
    return;
  }

  // Default generic error response
  const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500;
  res.status(statusCode).json({
    error: err?.isPublic ? err.message : 'An unexpected error occurred. Please try again.',
    code: err?.code || 'INTERNAL_ERROR',
  });
}
